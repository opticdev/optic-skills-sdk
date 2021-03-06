import Ajv from 'ajv'
const ajv = new Ajv();
import {ContainerNotFoundInSnippet, IncorrectArgumentType, InvalidGeneratorDefinition} from "../../Errors";
import {idRegex, validatePackageName} from "../../Regexes";
import {Snippet} from "./Snippet";
import {TrainGenerator} from "../bridge/GeneratorTrainingBridge";
import {AbstractionBase} from "../abstraction/Abstraction";
import {Finder} from "./Finders";
import {Assignment} from "./Assignments";
import {ComputedField} from "./ComputedField";
import {AbstractionComponent} from "./CollectAbstraction";


const generatorJSONValidation = {
	"type": "object",
	"required": [
		"id",
		"snippet",
		"schema",
	],
	"properties": {
		"name": {
			"type": "string"
		},
		"id": {
			"type": "string"
		},
		"value": {
			"type": "object"
		},
		"snippet": {
			"type": "object",
			"required": [
				"block",
				"language"
			],
			"properties": {
				"block": {
					"type": "string"
				},
				"language": {
					"type": "string"
				}
			}
		},
		"variables": {
			"type": "object",
			"additionalProperties": {
				"type": "string",
				"enum": [
					"self",
					"scope"
				]
			}
		},
		"containers": {
			"type": "object",
			"additionalProperties": {
				"type": "string",
				"enum": [
					"any",
					"exact",
					"same-plus",
					"same-any-order",
					"same-any-order-plus"
				]
			}
		},
		"schema": {
			"anyOf": [
				{
					"type": "string"
				},
				{
					"type": "object"
				}
			]
		},
		"priority": {
			"type": "number"
		},
		"initialValue": {
			"type": "object"
		}
	}
}

export class Generator {
	constructor() {
		this._name;
		this._id;
		this._snippet;
		this._abstraction = {}
		this._variables = {};
		this._containers = {};
		this._abstractionSchema;
		this._initialValue = {};
		this._priority = 1;
		this._internal = false;
		this._subgenerators = [];

		this._resolved = false
	}

	name(name) {
		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (typeof name === 'string') {
			this._name = name
		} else {
			throw new IncorrectArgumentType(name, 'string')
		}

		return this
	}

	id(id) {
		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (typeof id === 'string' && validatePackageName(id)) {
			this._id = id
		} else {
			throw new IncorrectArgumentType(id, 'string matching '+ idRegex)
		}

		return this
	}

	snippet(snippet) {
		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (typeof snippet === 'object' && snippet instanceof Snippet) {
			this._snippet = snippet
		} else {
			throw new IncorrectArgumentType(snippet, 'Snippet')
		}

		return this
	}

	abstraction(value) {
		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (typeof value === 'object') {
			this._abstraction = value
		} else {
			throw new IncorrectArgumentType(value, `abstraction format`)
		}

		return this
	}

	variables(value) {
		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (typeof value === 'object') {
			this._variables = value
		} else {
			throw new IncorrectArgumentType(value, `variables format`)
		}

		return this
	}

	containers(value) {

		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (typeof value === 'object') {
			this._containers = value
		} else {
			throw new IncorrectArgumentType(value, `containers format`)
		}

		return this
	}

	//schema
	abstractionSchemaRef() {
		if (typeof this._abstractionSchema === 'string') {
			return this._abstractionSchema
		} else {
			return this._id
		}
	}

	abstractionSchema(abstractionSchema) {

		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (abstractionSchema instanceof AbstractionBase) {
			this._abstractionSchema = abstractionSchema
		} else if (typeof abstractionSchema === 'string') { //@todo and is valid ref
			this._abstractionSchema = abstractionSchema
		} else if (typeof abstractionSchema === 'object') {
			this._abstractionSchema = abstractionSchema
		}
		else {
			throw new IncorrectArgumentType(abstractionSchema, `'Abstraction' or 'string' referencing abstractionSchema ie author:name/abstractionSchema-id`)
		}

		return this;
	}

	initialValue(initialValue) {

		if (this._resolved) throw new Error("Generator can not be modified after being compiled")


		if (typeof initialValue === 'object') {
			this._initialValue = initialValue
		} else {
			throw new IncorrectArgumentType(initialValue, 'object')
		}

		return this
	}

	priority(priority) {

		if (this._resolved) throw new Error("Generator can not be modified after being compiled")


		if (typeof priority === 'number') {
			this._priority = priority
		} else {
			throw new IncorrectArgumentType(priority, 'number')
		}

		return this;
	}

	internal(internal) {

		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (typeof internal === 'boolean') {
			this._internal = internal
		} else {
			throw new IncorrectArgumentType(internal, 'boolean')
		}

		return this;
	}

	subgenerators(array) {

		if (this._resolved) throw new Error("Generator can not be modified after being compiled")

		if (Array.isArray(array) && array.every((l) => l instanceof Generator)) {
			array.forEach(l => l.internal = true)
			this._subgenerators = array
		} else {
			throw new IncorrectArgumentType(array, 'an array of Generator objects')
		}

		return this
	}

	//processing code
	resolve() {

		if (this._resolved) { //never compile twice.
			return this;
		}

		const trainingResponse = TrainGenerator(this._snippet.language, this._snippet.block)

		const schemaFields = {}
		//handle value when finder involved
		const finderValues = Object.entries(this._abstraction).filter(i=> i[1] instanceof Finder || i[1] instanceof Assignment)

		finderValues.forEach(fPair => {
			const isAssignment = fPair[1] instanceof Assignment

			const key = fPair[0]
			const finder = (isAssignment) ? fPair[1].tokenAt : fPair[1]
			const finderResult = finder.evaluate(trainingResponse.trainingResults.candidates, this._id)
			if (isAssignment) {
				//@todo add something to the schema generation for these entries
				this._abstraction[key].tokenAt = finderResult.stagedComponent.component.at
			} else {
				schemaFields[key] = {...finderResult.schemaField, ...finder.options.rules}
				this._abstraction[key] = finderResult.stagedComponent.component
			}
		})

		Object.entries(this._abstraction).filter(i=> i[1] instanceof ComputedField).forEach(fPair => {
			const key = fPair[0]
			const {fieldProcessor, subcomponents} = fPair[1]
			//disallow recursion for now
			const processedComponents = subcomponents.filter(i=> i instanceof Finder || i instanceof Assignment || i instanceof AbstractionComponent).map(component => {

				if (component instanceof AbstractionComponent) {
					return component
				}

				const isAssignment = component instanceof Assignment
				const finder = (isAssignment) ? component.tokenAt : component
				const finderResult = finder.evaluate(trainingResponse.trainingResults.candidates, this._id)

				if (isAssignment) {
					return {...component, tokenAt: finderResult.stagedComponent.component.at}
				} else {
					return finderResult.stagedComponent.component
				}
			})


			fPair[1].subcomponents = processedComponents

			switch (fieldProcessor) {
				case 'ConcatStrings':
					schemaFields[key] = {type: 'string'}
					break;
				case 'ConcatArrays':
					schemaFields[key] = {type: 'array'}
					break;
			}

		})


		//build the schema
		if (!this._abstractionSchema) {
			this._abstractionSchema = new AbstractionBase(
				null,
				{
					title: this._name,
					type: 'object',
					required: Object.entries(this._abstraction).map(i=> i[0]),
					properties: schemaFields
				}
			)
		}

		this._resolved = true
		return this
	}

	generatorDescription() {
		const generatorFinal = this.resolve()
		const description = {
			name: this._name,
			id: this._id,
			snippet: this._snippet,
			value: this._abstraction,
			variables: this._variables,
			containers: this._containers,
			schema: this._abstractionSchema,
			initialValue: this._initialValue,
			priority: this._priority,
			internal: this._internal
		}

		const isValid = ajv.validate(generatorJSONValidation, description)
		if (!isValid) {
			throw new InvalidGeneratorDefinition(ajv.errors.map(i=> i.message).join(', '))
		}

		return description
	}

}
