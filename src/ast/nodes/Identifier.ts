/// <reference path="./Identifier.d.ts" />

import Node, { ForEachReturnExpressionCallback } from '../Node';
import isReference from 'is-reference';
import { UNKNOWN_ASSIGNMENT, UnknownAssignment, PredicateFunction } from '../values';
import Scope from '../scopes/Scope';
import Expression from './Expression';
import ExecutionPathOptions from '../ExecutionPathOptions';
import Declaration from './Declaration';
import Variable from '../variables/Variable';
import CallOptions from '../CallOptions';
import FunctionScope from '../scopes/FunctionScope';
import MagicString from 'magic-string';
import Property from './Property';
import { ObjectPath } from '../variables/VariableReassignmentTracker';

export default class Identifier extends Node {
	type: 'Identifier';
	name: string;

	variable: Variable;

	reassignPath (path: ObjectPath, options: ExecutionPathOptions) {
		this._bindVariableIfMissing();
		this.variable && this.variable.reassignPath(path, options);
	}

	bindNode () {
		this._bindVariableIfMissing();
	}

	_bindVariableIfMissing () {
		if (!this.variable && isReference(this, this.parent)) {
			this.variable = this.scope.findVariable(this.name);
			this.variable.addReference(this);
		}
	}

	forEachReturnExpressionWhenCalledAtPath (
		path: ObjectPath,
		callOptions: CallOptions,
		callback: ForEachReturnExpressionCallback,
		options: ExecutionPathOptions
	) {
		this._bindVariableIfMissing();
		this.variable &&
		this.variable.forEachReturnExpressionWhenCalledAtPath(
			path,
			callOptions,
			callback,
			options
		);
	}

	hasEffectsWhenAccessedAtPath (path: ObjectPath, options: ExecutionPathOptions): boolean {
		return (
			this.variable && this.variable.hasEffectsWhenAccessedAtPath(path, options)
		);
	}

	hasEffectsWhenAssignedAtPath (path: ObjectPath, options: ExecutionPathOptions): boolean {
		return (
			!this.variable ||
			this.variable.hasEffectsWhenAssignedAtPath(path, options)
		);
	}

	hasEffectsWhenCalledAtPath (path: ObjectPath, callOptions: CallOptions, options: ExecutionPathOptions) {
		return (
			!this.variable ||
			this.variable.hasEffectsWhenCalledAtPath(path, callOptions, options)
		);
	}

	includeInBundle () {
		if (this.included) return false;
		this.included = true;
		this.variable && this.variable.includeVariable();
		return true;
	}

	initialiseAndDeclare (parentScope: Scope, kind: string, init: Declaration | Expression | UnknownAssignment | null) {
		this.initialiseScope(parentScope);
		switch (kind) {
			case 'var':
			case 'function':
				this.variable = this.scope.addDeclaration(this, {
					isHoisted: true,
					init
				});
				break;
			case 'let':
			case 'const':
			case 'class':
				this.variable = this.scope.addDeclaration(this, { init });
				break;
			case 'parameter':
				this.variable = (<FunctionScope>this.scope).addParameterDeclaration(this);
				break;
			default:
				throw new Error(`Unexpected identifier kind ${kind}.`);
		}
	}

	render (code: MagicString, es: boolean) {
		if (this.variable) {
			const name = this.variable.getName(es);
			if (name !== this.name) {
				code.overwrite(this.start, this.end, name, {
					storeName: true,
					contentOnly: false
				});

				// special case
				if (this.parent.type === 'Property' && (<Property>this.parent).shorthand) {
					code.appendLeft(this.start, `${this.name}: `);
				}
			}
		}
	}

	someReturnExpressionWhenCalledAtPath (
		path: ObjectPath,
		callOptions: CallOptions,
		predicateFunction: (options: ExecutionPathOptions) => PredicateFunction,
		options: ExecutionPathOptions
	) {
		if (this.variable) {
			return this.variable.someReturnExpressionWhenCalledAtPath(
				path,
				callOptions,
				predicateFunction,
				options
			);
		}
		return predicateFunction(options)(UNKNOWN_ASSIGNMENT);
	}
}
