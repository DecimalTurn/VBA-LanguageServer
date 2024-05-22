import { ParserRuleContext } from 'antlr4ts';
import { Range, SemanticTokenModifiers, SemanticTokenTypes, SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { FoldingRangeKind } from '../../capabilities/folding';
import { IdentifierElement } from './memory';
import { AttributeStmtContext } from '../../antlr/out/vbaParser';
import '../../extensions/parserExtensions';

export interface ContextOptionalSyntaxElement {
	range?: Range;
	parent?: ContextOptionalSyntaxElement;
	context?: ParserRuleContext;
	get text(): string;
	get uri(): string;

	isChildOf(range: Range): boolean;
}

interface SyntaxElement extends ContextOptionalSyntaxElement {
	range: Range;
	context: ParserRuleContext;
}

export interface HasAttribute {
	processAttribute(context: AttributeStmtContext): void;
}

export interface NamedSyntaxElement extends SyntaxElement {
	get name(): string;
}

export interface IdentifiableSyntaxElement extends NamedSyntaxElement {
	identifier: IdentifierElement;
}

export interface HasSymbolInformation extends NamedSyntaxElement {
	symbolInformation: SymbolInformation;
}

export interface HasSemanticToken extends NamedSyntaxElement, IdentifiableSyntaxElement {
	tokenType: SemanticTokenTypes;
	tokenModifiers: SemanticTokenModifiers[];
}

export interface MemoryElement extends BaseSyntaxElement {
	name: string;
	returnType: any;
	symbol: SymbolKind;
}

export interface FoldingRangeElement {
	range: Range;
	foldingRangeKind?: FoldingRangeKind;
}

export abstract class BaseSyntaxElement implements ContextOptionalSyntaxElement {
	protected document: TextDocument;
	
	range?: Range;
	parent?: ContextOptionalSyntaxElement;
	context?: ParserRuleContext;

	get text(): string { return this.context?.text ?? ''; }
	get uri(): string { return this.document.uri; }

	constructor(context: ParserRuleContext | undefined, document: TextDocument) {
		this.context = context;
		this.document = document;
		this.range = this._contextToRange();
	}

	isChildOf = (range: Range): boolean => {
		if (!this.range) {
			return false;
		}

		const isPositionBefore = (x: Position, y: Position) =>
			x.line < y.line || (x.line === y.line && x.character <= y.character);

		return isPositionBefore(range.start, this.range.start)
			&& isPositionBefore(this.range.end, range.end);
	};

	private _contextToRange(): Range | undefined {
		if (!this.context) {
			return;
		}

		const startIndex = this.context.start.startIndex;
		const stopIndex = this.context.stop?.stopIndex ?? startIndex;
		return Range.create(
			this.document.positionAt(startIndex),
			this.document.positionAt(stopIndex)
		);
	}
}

export abstract class BaseContextSyntaxElement extends BaseSyntaxElement {
	range!: Range;
	context!: ParserRuleContext;

	constructor(ctx: ParserRuleContext, doc: TextDocument) {
		super(ctx, doc);
	}
}