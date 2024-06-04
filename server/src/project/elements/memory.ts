import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticTokenModifiers, SemanticTokenTypes, SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { AmbiguousIdentifierContext, ConstItemContext, EnumDeclarationContext, EnumMemberContext, FunctionDeclarationContext, ProcedureDeclarationContext, PropertyGetDeclarationContext, PropertySetDeclarationContext, ReservedMemberNameContext, SubroutineDeclarationContext, UdtDeclarationContext, UdtElementContext, UntypedNameContext, VariableDclContext } from '../../antlr/out/vbaParser';

import { BaseContextSyntaxElement, HasSemanticToken, HasSymbolInformation, IdentifiableSyntaxElement, NamedSyntaxElement } from './base';

import { ScopeElement } from './special';
import { VbaClassDocument, VbaModuleDocument } from '../document';
import { SymbolInformationFactory } from '../../capabilities/symbolInformation';
import '../../extensions/parserExtensions';



export class IdentifierElement extends BaseContextSyntaxElement {
	constructor(ctx: UntypedNameContext | ConstItemContext | AmbiguousIdentifierContext | ReservedMemberNameContext, doc: TextDocument) {
		super(ctx, doc);
	}
}

export abstract class DeclarationElement extends ScopeElement {
	abstract identifier: IdentifierElement;

	constructor(context: ProcedureDeclarationContext, document: TextDocument) {
		super(context, document);
	}
	get name(): string {
		throw new Error('Method not implemented.');
	}

	static create(context: ProcedureDeclarationContext, document: VbaClassDocument | VbaModuleDocument) {
		let methodContext: SubroutineDeclarationContext | FunctionDeclarationContext | PropertyGetDeclarationContext | null;
		methodContext = context.subroutineDeclaration();
		if (methodContext) {
			return new SubDeclarationElement(context, document.textDocument, methodContext);
		}

		methodContext = context.functionDeclaration();
		if (methodContext) {
			return new FunctionDeclarationElement(context, document.textDocument, methodContext);
		}

		const propertyDeclaration = new PropertyDeclarationElement(context, document.textDocument);
		const predeclaredElements = document.currentScopeElement?.declaredNames.get(propertyDeclaration.identifier.text);
		predeclaredElements?.forEach(predeclaredElement => {
			if (predeclaredElement && isPropertyDeclarationElement(predeclaredElement)) {
				predeclaredElement.addPropertyDeclaration(context, document.textDocument);
				return predeclaredElement;
			}
		});
		return propertyDeclaration;
	}

}

export class SubDeclarationElement extends DeclarationElement implements HasSymbolInformation {
	identifier: IdentifierElement;
	symbolInformation: SymbolInformation;

	constructor(context: ProcedureDeclarationContext, document: TextDocument, methodContext: SubroutineDeclarationContext) {
		super(context, document);

		const identifierContext = methodContext.subroutineName()?.ambiguousIdentifier();
		this.identifier = new IdentifierElement(identifierContext!, document);
		this.symbolInformation = SymbolInformation.create(
			this.identifier.text,
			SymbolKind.Method,
			this.range,
			this.document.uri
		);
	}
}

export class FunctionDeclarationElement extends DeclarationElement implements HasSymbolInformation {
	identifier: IdentifierElement;
	symbolInformation: SymbolInformation;

	constructor(context: ProcedureDeclarationContext, document: TextDocument, methodContext: FunctionDeclarationContext) {
		super(context, document);
		const identifierContext = methodContext.functionName()!.ambiguousIdentifier()!;
		this.identifier = new IdentifierElement(identifierContext, document);
		this.symbolInformation = SymbolInformation.create(
			this.identifier.text,
			SymbolKind.Method,
			this.range,
			this.document.uri
		);
	}
}

export class PropertyDeclarationElement extends DeclarationElement implements HasSymbolInformation {
	identifier: IdentifierElement;
	symbolInformation: SymbolInformation;
	getDeclarations: PropertyGetDeclarationElement[] = [];
	letDeclarations: PropertyLetDeclarationElement[] = [];
	setDeclarations: PropertyLetDeclarationElement[] = [];

	constructor(context: ProcedureDeclarationContext, document: TextDocument) {
		super(context, document);
		this.identifier = this.addPropertyDeclaration(context, document);
		this.symbolInformation = SymbolInformation.create(
			this.identifier.text,
			SymbolKind.Property,
			this.range,
			this.document.uri
		);
	}

	addPropertyDeclaration(context: ProcedureDeclarationContext, document: TextDocument) {
		switch (true) {
			case !!context.propertyGetDeclaration():
				// Property Get
				this.getDeclarations.push(new PropertyGetDeclarationElement(context, document, context.propertyGetDeclaration()!));
				return this.getDeclarations[0].identifier;
			case !!context.propertySetDeclaration()?.LET():
				// Property Let
				this.letDeclarations.push(new PropertyLetDeclarationElement(context, document, context.propertySetDeclaration()!));
				return this.letDeclarations[0].identifier;
			default:
				// Property Set
				this.setDeclarations.push(new PropertySetDeclarationElement(context, document, context.propertySetDeclaration()!));
				return this.setDeclarations[0].identifier;
		}
	}
}

class PropertyGetDeclarationElement extends DeclarationElement {
	identifier: IdentifierElement;

	constructor(context: ProcedureDeclarationContext, document: TextDocument, getContext: PropertyGetDeclarationContext) {
		super(context, document);
		this.identifier = new IdentifierElement(getContext.functionName()!.ambiguousIdentifier()!, document);
	}
}

class PropertyLetDeclarationElement extends DeclarationElement {
	identifier: IdentifierElement;

	constructor(context: ProcedureDeclarationContext, document: TextDocument, setContext: PropertySetDeclarationContext) {
		super(context, document);
		this.identifier = new IdentifierElement(setContext.subroutineName()!.ambiguousIdentifier()!, document);
	}
}

class PropertySetDeclarationElement extends DeclarationElement {
	identifier: IdentifierElement;

	constructor(context: ProcedureDeclarationContext, document: TextDocument, setContext: PropertySetDeclarationContext) {
		super(context, document);
		this.identifier = new IdentifierElement(setContext.subroutineName()!.ambiguousIdentifier()!, document);
	}
}

function isPropertyDeclarationElement(element: IdentifiableSyntaxElement): element is PropertyDeclarationElement {
	return 'getDeclarations' in element;
}

abstract class BaseEnumDeclarationElement extends ScopeElement implements HasSemanticToken, HasSymbolInformation {
	identifier: IdentifierElement;
	tokenModifiers: SemanticTokenModifiers[] = [];
	declaredNames: Map<string, EnumMemberDeclarationElement[]> = new Map();

	abstract tokenType: SemanticTokenTypes;
	abstract symbolInformation: SymbolInformation;

	get name(): string {
		return this.identifier.text;
	}

	constructor(context: EnumDeclarationContext | EnumMemberContext, document: TextDocument) {
		super(context, document);
		this.identifier = new IdentifierElement(context.untypedName().ambiguousIdentifier()!, document);
	}

}

export class EnumDeclarationElement extends BaseEnumDeclarationElement implements ScopeElement {
	tokenType: SemanticTokenTypes;

	constructor(context: EnumDeclarationContext, document: TextDocument) {
		super(context, document);
		this.tokenType = SemanticTokenTypes.enum;
		this.identifier = new IdentifierElement(context.untypedName().ambiguousIdentifier()!, document);
		context.enumMemberList().enumElement().forEach(enumElementContext =>
			this._pushDeclaredName(new EnumMemberDeclarationElement(enumElementContext.enumMember()!, document))
		);
	}

	get symbolInformation(): SymbolInformation {
		return SymbolInformationFactory.create(
			this, SymbolKind.Enum
		);
	}
}

class EnumMemberDeclarationElement extends BaseEnumDeclarationElement {
	tokenType: SemanticTokenTypes;

	constructor(context: EnumMemberContext, document: TextDocument) {
		super(context, document);
		this.tokenType = SemanticTokenTypes.enumMember;
		this.identifier = new IdentifierElement(context.untypedName().ambiguousIdentifier()!, document);
	}

	get symbolInformation(): SymbolInformation {
		return SymbolInformationFactory.create(
			this, SymbolKind.EnumMember
		);
	}
}

abstract class BaseVariableDeclarationStatementElement extends BaseContextSyntaxElement implements HasSemanticToken, HasSymbolInformation, NamedSyntaxElement {
	tokenType: SemanticTokenTypes;
	tokenModifiers: SemanticTokenModifiers[] = [];
	readonly symbolKind: SymbolKind;
	
	abstract identifier: IdentifierElement;

	get name(): string {
		return this.identifier.text;
	}

	get symbolInformation(): SymbolInformation {
		return SymbolInformation.create(
			this.identifier.text,
			this.symbolKind,
			this.range,
			this.document.uri
		);
	}

	constructor(context: VariableDclContext | ConstItemContext | UdtElementContext, document: TextDocument, tokenType: SemanticTokenTypes, symbolKind: SymbolKind) {
		super(context, document);
		this.tokenType = tokenType;
		this.symbolKind = symbolKind;
	}
}

export class ConstDeclarationElement extends BaseVariableDeclarationStatementElement {
	tokenModifiers: SemanticTokenModifiers[] = [];
	identifier: IdentifierElement;
	
	get name(): string {
		return this.identifier.text;
	}

	constructor(context: ConstItemContext, document: TextDocument) {
		super(context, document, SemanticTokenTypes.variable, SymbolKind.Constant);
		this.identifier = new IdentifierElement(context, document);
	}
}

export class TypeDeclarationElement  extends ScopeElement implements HasSemanticToken, HasSymbolInformation, NamedSyntaxElement {
	tokenType: SemanticTokenTypes;
	tokenModifiers: SemanticTokenModifiers[] = [];
	identifier: IdentifierElement;
	symbolKind: SymbolKind;
	declaredNames: Map<string, TypeMemberDeclarationElement[]> = new Map();

	constructor(context: UdtDeclarationContext, document: TextDocument) {
		super(context, document);
		this.symbolKind = SymbolKind.Struct;
		this.tokenType = SemanticTokenTypes.struct;
		this.identifier = new IdentifierElement(context.untypedName(), document);
		context.udtMemberList().udtElement().forEach(member =>
			this._pushDeclaredName(new TypeMemberDeclarationElement(member, document))
		);
	}

	get name(): string { return this.identifier.text; }
	get symbolInformation(): SymbolInformation {
		return SymbolInformationFactory.create(
			this as NamedSyntaxElement, this.symbolKind
		);
	}
}

export class TypeMemberDeclarationElement extends BaseVariableDeclarationStatementElement {
	tokenModifiers: SemanticTokenModifiers[] = [];
	identifier: IdentifierElement;
	
	get name(): string {
		return this.identifier.text;
	}

	constructor(context: UdtElementContext, document: TextDocument) {
		super(context, document, SemanticTokenTypes.property, SymbolKind.Property);
		const identifierContext = context.udtMember()?.untypedNameMemberDcl()?.ambiguousIdentifier() ?? context.udtMember()?.reservedNameMemberDcl()?.reservedMemberName();
		this.identifier = new IdentifierElement(identifierContext!, document);
	}
}

// export class VariableDeclarationsElement extends BaseVariableDeclarationStatementElement {
// 	declarations: VariableDeclarationElement[] = [];

// 	constructor(context: VariableStmtContext, document: TextDocument) {
// 		super(context, document);
// 		context.variableListStmt().variableSubStmt().forEach((element) =>
// 			this.declarations.push(new VariableDeclarationElement(
// 				element, document
// 			))
// 		);
// 	}
// }

// class VariableDeclarationElement extends BaseContextSyntaxElement implements HasSymbolInformation {
// 	identifier: IdentifierElement;
// 	asType: VariableType;
// 	arrayBounds?: ArrayBounds;

// 	constructor(context: ConstSubStmtContext | VariableSubStmtContext, document: TextDocument) {
// 		super(context, document);
// 		this.asType = new VariableType(context.asTypeClause(), document);
// 		this.arrayBounds = ArrayBounds.create(context);
// 		this.identifier = new IdentifierElement(context.ambiguousIdentifier(), document);
// 	}

// 	get name(): string { return this.identifier.text; }
// 	get symbolInformation(): SymbolInformation {
// 		return SymbolInformationFactory.create(
// 			this, this.asType.symbolKind
// 		);
// 	}
// }

// class VariableType extends BaseSyntaxElement {
// 	typeName: string;
// 	symbolKind: SymbolKind;

// 	constructor(context: AsTypeClauseContext | undefined, document: TextDocument, isArray?: boolean) {
// 		super(context, document);
// 		this.symbolKind = isArray ? SymbolKind.Array : SymbolKind.Variable;

// 		// Needs more ternery.
// 		const type = context?.type_()?.baseType() ?? context?.type_()?.complexType();
// 		this.typeName = type?.text ?? type?.text ?? 'Variant';
// 		this.symbolKind = type ? type.toSymbolKind() : SymbolKind.Variable;
// 	}
// }

// class ArrayBounds {
// 	dimensions: { lower: number, upper: number }[] = [];

// 	constructor(subStmt: VariableSubStmtContext) {
// 		subStmt.subscripts()?.subscript_().forEach((x) => {
// 			const vals = x.valueStmt();
// 			this.dimensions.push({
// 				lower: vals.length === 1 ? 0 : +vals[0].text,
// 				upper: vals.length === 1 ? +vals[0].text : +vals[1].text
// 			});
// 		});
// 	}

// 	/**
// 	 * Creates an ArrayBounds if the context is a variable and an array.
// 	 * @param subStmt a subStmt context for a variable or a constant.
// 	 * @returns A new array bounds if the context is an array variable.
// 	 */
// 	static create(subStmt: VariableSubStmtContext | ConstSubStmtContext) {
// 		const hasLparenMethod = (x: any): x is VariableSubStmtContext => 'LPAREN' in x;
// 		if (hasLparenMethod(subStmt) && subStmt.LPAREN()) {
// 			return new ArrayBounds(subStmt);
// 		}
// 	}
// }