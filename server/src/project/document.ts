// Core
import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { CancellationToken, Diagnostic, SymbolInformation, SymbolKind } from 'vscode-languageserver';

// Antlr
import { ParserRuleContext } from 'antlr4ng';

// Project
import { Services } from '../injection/services';
import { IWorkspace } from '../injection/interface';
import { Dictionary } from '../utils/helpers';
import { SyntaxParser } from './parser/vbaParser';
import { FoldingRange } from '../capabilities/folding';
import { VbaFmtListener } from './parser/vbaListener';
import { BaseDiagnostic } from '../capabilities/diagnostics';
import { SemanticTokensManager } from '../capabilities/semanticTokens';
import { ScopeItemCapability } from '../capabilities/capabilities';
import {
	BaseRuleSyntaxElement,
	BaseSyntaxElement,
	HasDiagnosticCapability,
	HasFoldingRangeCapability,
	HasScopeItemCapability,
	HasSemanticTokenCapability,
	HasSymbolInformationCapability
} from './elements/base';
import {
	PropertyDeclarationElement,
	PropertyGetDeclarationElement,
	PropertyLetDeclarationElement,
	PropertySetDeclarationElement
} from './elements/procedure';


// TODO ---------------------------------------------
//	* Create a special register property that registers the name
//    normally and tracks to avoid readding duplicates (unless we have two gets).
//    Consider making all variables get/set/let for simplicity in assignment.
//    Obviously Const will only have a get.
//  * Fix the rest of the scope and variable bits.
// 	* Write tests for it all.
// --------------------------------------------------


export abstract class BaseProjectDocument {
	readonly name: string;
	readonly workspace: IWorkspace;
	readonly textDocument: TextDocument;
	readonly version: number;

	protected diagnostics: Diagnostic[] = [];
	protected documentScopeDeclarations: Map<string, Map<string, any>> = new Map();
	protected foldableElements: FoldingRange[] = [];
	protected hasDiagnosticElements: HasDiagnosticCapability[] = [];
	protected properties: Dictionary<string, PropertyDeclarationElement> = new Dictionary(() => new PropertyDeclarationElement());
	protected redactedElements: BaseRuleSyntaxElement<ParserRuleContext>[] = [];
	protected semanticTokens: SemanticTokensManager = new SemanticTokensManager();
	protected symbolInformations: SymbolInformation[] = [];
	protected unhandledNamedElements: [] = [];
	protected isClosed = false;
	protected currentScope: ScopeItemCapability;

	abstract symbolKind: SymbolKind

	protected _isBusy = true;
	get isBusy() { return this._isBusy; }

	get isOversize() {
		// Workaround for async getter.
		return (async () => {
			const config = await Services.server.clientConfiguration;
			return config && this.textDocument.lineCount > config.maxDocumentLines;
		})();
	}

	get redactedText() {
		return this.subtractTextFromRanges(this.redactedElements.map(x => x.context.range));
	}

	constructor(name: string, document: TextDocument) {
		this.textDocument = document;
		this.workspace = Services.workspace;
		this.version = document.version;
		this.name = name;
		this.currentScope = Services.projectScope;
	}

	static create(document: TextDocument): BaseProjectDocument {
		const slashParts = document.uri.split('/').at(-1);
		const dotParts = slashParts?.split('.');
		const extension = dotParts?.at(-1);
		const filename = dotParts?.join('.');

		if (!filename || !extension) {
			throw new Error("Unable to parse document uri");
		}

		switch (extension) {
			case 'cls':
				return new VbaClassDocument(filename, document, SymbolKind.Class);
			case 'bas':
				return new VbaModuleDocument(filename, document, SymbolKind.Class);
			case 'frm':
				return new VbaModuleDocument(filename, document, SymbolKind.Class);
			default:
				throw new Error("Expected *.cls, *.bas, or *.frm but got *." + extension);
		}
	}

	close(): void {
		this.isClosed = true;
	}

	open(): void {
		this.isClosed = false;
	}

	languageServerSemanticTokens = (range?: Range) => {
		return this.semanticTokens.getSemanticTokens(range);
	};

	languageServerFoldingRanges(): FoldingRange[] {
		return this.foldableElements;
	}

	languageServerSymbolInformation(): SymbolInformation[] {
		return this.symbolInformations;
	}

	// languageServerDiagnostics(): DocumentDiagnosticReport {
	// 	return {
	// 		kind: DocumentDiagnosticReportKind.Full,
	// 		items: this.isClosed ? [] : this.diagnostics
	// 	};
	// }
	languageServerDiagnostics() {
		const diagnostics = this.isClosed ? [] : this.diagnostics;
		Services.logger.debug(`Sending diagnostics for ${this.textDocument.uri}`);
		Services.logger.debug(JSON.stringify(diagnostics));

		return {
			uri: this.textDocument.uri,
			version: this.version,
			diagnostics: diagnostics
		};
	}

	async formatParseVisit(token: CancellationToken): Promise<VbaFmtListener> {
		try {
			return await (new SyntaxParser(Services.logger)).formatParse(token, this);
		} catch (e) {
			Services.logger.debug('caught doc');
			throw e;
		}
	}

	async parse(token: CancellationToken): Promise<void> {
		// Don't parse oversize documents.
		if (await this.isOversize) {
			Services.logger.debug(`Document oversize: ${this.textDocument.lineCount} lines.`);
			Services.logger.warn(`Syntax parsing has been disabled to prevent crashing.`);
			this._isBusy = false;
			return;
		}

		// Parse the document.
		await (new SyntaxParser(Services.logger)).parse(token, this);
		const projectScope = this.currentScope.project;
		const buildScope = projectScope?.isDirty ? projectScope : this.currentScope;
		projectScope?.clean();
		buildScope.build();
		buildScope.resolveUnused();

		// Evaluate the diagnostics.
		const diagnostics = this.hasDiagnosticElements
			.map(e => e.diagnosticCapability.evaluate())
			.flat();

		// Ensure diagnostics aren't reported twice.
		// TODO: Redesign diagnostics so this isn't required.
		diagnostics.forEach(diagnostic => {
			if (!this.hasDiagnostic(diagnostic)) {
				this.diagnostics.push(diagnostic);
			}
		});

		this._isBusy = false;
	};

	async formatParse(token: CancellationToken): Promise<VbaFmtListener | undefined> {
		// Don't parse oversize documents.
		if (await this.isOversize) {
			Services.logger.debug(`Document oversize: ${this.textDocument.lineCount} lines.`);
			Services.logger.warn(`Syntax parsing has been disabled to prevent crashing.`);
			return;
		}

		// Parse the document.
		return await (new SyntaxParser(Services.logger)).formatParse(token, this);
	}

	/**
	 * Auto registers the element based on capabilities.
	 * @returns This for chaining.
	 */
	registerElement(element: BaseSyntaxElement) {
		if (element.diagnosticCapability) this.registerDiagnosticElement(element as HasDiagnosticCapability);
		if (element.foldingRangeCapability) this.registerFoldableElement(element as HasFoldingRangeCapability);
		if (element.semanticTokenCapability) this.registerSemanticToken(element as HasSemanticTokenCapability);
		if (element.symbolInformationCapability) this.registerSymbolInformation(element as HasSymbolInformationCapability);
		if (element.scopeItemCapability) this.registerScopeItem(element as HasScopeItemCapability);
		return this;
	}

	registerPropertyElementDeclaration(element: PropertyGetDeclarationElement | PropertySetDeclarationElement | PropertyLetDeclarationElement) {
		const elementName = element.propertyName;
		this.properties.getOrSet(elementName)
			.addPropertyDeclaration(element);
		return this;
	}

	private registerDiagnosticElement(element: HasDiagnosticCapability) {
		this.hasDiagnosticElements.push(element);
		return this;
	}

	private registerFoldableElement = (element: HasFoldingRangeCapability) => {
		this.foldableElements.push(element.foldingRangeCapability.foldingRange);
		return this;
	};

	/**
	 * Registers a semantic token element for tracking with the SemanticTokenManager.
	 * @param element element The element that has a semantic token.
	 * @returns this for chaining.
	 */
	private registerSemanticToken = (element: HasSemanticTokenCapability) => {
		this.semanticTokens.add(element);
		return this;
	};

	registerSubtractElement = (element: BaseRuleSyntaxElement<ParserRuleContext>) => {
		this.redactedElements.push(element);
		return this;
	};

	/**
	 * Registers a SymbolInformation.
	 * @param element The element that has symbol information.
	 * @returns this for chaining.
	 */
	private registerSymbolInformation = (element: HasSymbolInformationCapability) => {
		this.symbolInformations.push(element.symbolInformationCapability.SymbolInformation);
		return this;
	};

	private registerScopeItem = (element: HasScopeItemCapability) =>
		this.currentScope = this.currentScope.registerScopeItem(element.scopeItemCapability);

	exitContext = (ctx: ParserRuleContext) => {
		if (ctx === this.currentScope.element?.context.rule) {
			const parent = this.currentScope.parent;
			this.currentScope = parent ?? this.currentScope;
		}
	};

	private subtractTextFromRanges(ranges: Range[]): string {
		const text = this.textDocument.getText();
		return ranges.reduce((x, y) => this.subtractTextRange(x, y), text);
	}

	/**
	 * Subtracts text by replacing it with white space.
	 * @param text the text to act on.
	 * @param range the range to subtract.
	 * @returns the original text with the range replaced by spaces.
	 */
	private subtractTextRange(text: string, range: Range): string {
		const docLines = text.split('\r\n');

		if (range.start.line === range.end.line) {
			// When the start and end lines are the same, subtract a substring.
			const x = range.end.character;
			const y = range.start.character;
			const i = range.start.line - 1;
			const line = docLines[i];
			const subtraction = ' '.repeat(x - y + 1);
			docLines[i] = line.slice(0, y) + subtraction + line.slice(x + 1);
			return docLines.join('\r\n');
		} else {
			// When they aren't, subtract whole lines between start and end.
			const x = range.end.line;
			const y = range.start.line;

			// Replace the subtracted lines with spaces to maintain individual
			// character positional integrity.
			const result = docLines.map((line, i) =>
				i >= y && i < x ? ' '.repeat(line.length) : line
			);
			return result.join('\r\n');
		}
	}

	private hasDiagnostic(diagnostic: BaseDiagnostic): boolean {
		for (const pushedDiagnostic of this.diagnostics) {
			if (diagnostic.equals(pushedDiagnostic)) {
				return true;
			}
		}
		return false;
	}
}


export class VbaClassDocument extends BaseProjectDocument {
	symbolKind: SymbolKind;
	constructor(name: string, document: TextDocument, symbolKind: SymbolKind) {
		super(name, document);
		this.symbolKind = symbolKind;
	}
}


export class VbaModuleDocument extends BaseProjectDocument {
	symbolKind: SymbolKind;
	constructor(name: string, document: TextDocument, symbolKind: SymbolKind) {
		super(name, document);
		this.symbolKind = symbolKind;
	}
}
