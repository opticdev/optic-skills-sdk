#!/usr/bin/env node

import program from 'commander'
import pJson from '../../package'
import fs from 'fs'
import {isValidPackageJson} from "./Utils";
import {execSync} from 'child_process';
import niceTry from 'nice-try'
import colors from 'colors'
import prompt from 'prompt'
import {idRegex} from "../Regexes";
import {initInDirectory} from "./Init";
import {addUser, createUser} from "./registry/UserManagment";
import 'regenerator-runtime/runtime';

prompt.message = ''

program
	.name('Optic SDK')
	.version(pJson.version)


program
	.command('publishlocal [skill-name]')
	.option('-input, --input <dir>', 'Skill directory. Defaults to cwd')
	.action((skillName, cmd) => publishHandler(skillName, cmd, false))

program
	.command('publish [skill-name]')
	.option('-input, --input <dir>', 'Skill directory. Defaults to cwd')
	.action((skillName, cmd) => publishHandler(skillName, cmd, true))

program
	.command('init')
	.description('add boilerplate skill to cwd')
	.action(() => {
		const fieldSchema = {
			pattern: idRegex,
			message: 'Author name must be only lowercase letters, numbers, or dashes',
			required: true
		}
		const schema = {
			properties: {
				author: fieldSchema,
				'skill-name': fieldSchema,
				version: {
					pattern: /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?\b/ig,
					required: true
				}
			}
		};
		const targetDir = process.cwd()
		prompt.start();
		prompt.get(schema, function (err, result) {
			if(!err) {
				initInDirectory(process.cwd(), result.author, result['skill-name'], result.version)
			}
		})
	})


program
	.command('createuser')
	.description('create a new user on registry.useoptic.com')
	.action(() => {

		const schema = {
			properties: {
				email: {
					required: true,
				},
				password: {
					required: true,
					hidden: true
				},
				namespace: {
					required: true,
				}
			}
		};

		prompt.get(schema, function (err, result) {
			createUser(result.email, result.password, result.namespace)
			return
		})

	})

program
	.command('adduser')
	.description('add a new optic account to this computer')
	.action(() => {
		const schema = {
			properties: {
				email: {
					required: true
				},
				password: {
					required: true,
					hidden: true
				}
			}
		};

		prompt.get(schema, function (err, result) {
			addUser(result.email, result.password)
			return
		})
	})


if (!process.argv.slice(2).length) {
	program.outputHelp(make_red);
}

function make_red(txt) {
	return colors.red(txt); //display the help text in red on the console
}

function publishHandler(skillName, cmd, remote = false) {
	const path = cmd.input || process.cwd()
	const packageJsonPath = path +'/package.json'


	if (fs.existsSync(packageJsonPath) && isValidPackageJson(fs.readFileSync(packageJsonPath, 'utf8'))) {
		execSync('npm run build', {cwd: path});

		if (remote) {
			const publishRemote = require(path + '/node_modules/optic-skills-sdk').publishRemote
			publishRemote(skillName, path + '/lib')
				.catch((error) => console.log(error.message.red))
		} else {
			const localpublish = require(path + '/node_modules/optic-skills-sdk').publishLocal
			localpublish(skillName, path + '/lib')
				.catch((error) => console.log(error.message.red))
		}

	} else {
		console.log('publishlocal must be run from a directory containing an Optic skill project. Run \'opticsdk init\' to create one'.red)
	}
}

program.parse(process.argv)
