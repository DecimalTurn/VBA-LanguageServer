import { CancellationToken, Diagnostic, DocumentDiagnosticReport, DocumentDiagnosticReportKind, SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { Workspace } from './workspace';
import { FoldableElement } from './elements/special';
import { BaseContextSyntaxElement, HasDiagnosticCapability, HasNamedSemanticToken, HasSemanticToken, HasSymbolInformation, NamedSyntaxElement } from './elements/base';
import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { SyntaxParser } from './parser/vbaParser';
import { FoldingRange } from '../capabilities/folding';
import { SemanticTokensManager } from '../capabilities/semanticTokens';
import { ParseCancellationException } from 'antlr4ng';

export interface DocumentSettings {
	maxDocumentLines: number;
	maxNumberOfProblems: number;
	doWarnOptionExplicitMissing: boolean;
	environment: {
		os: string;
		version: string;
	}
}

export abstract class BaseProjectDocument {
	readonly name: string;
	readonly workspace: Workspace;
	readonly textDocument: TextDocument;
	protected _documentConfiguration?: DocumentSettings;
	
	protected _hasDiagnosticElements: HasDiagnosticCapability[] = [];
	protected _unhandledNamedElements: [] = [];
	protected _documentScopeDeclarations: Map<string, Map<string, any>> = new Map();
	
	protected _diagnostics: Diagnostic[] = [];
	protected _foldableElements: FoldingRange[] = [];
	protected _symbolInformations: SymbolInformation[] = [];
	protected _semanticTokens: SemanticTokensManager = new SemanticTokensManager();
	protected _redactedElements: BaseContextSyntaxElement[] = [];
	
	protected _isBusy = true;
	abstract symbolKind: SymbolKind

	get isBusy() {
		return this._isBusy;
	}

	get isOversize() {
		// Workaround for async getter.
		return (async () =>
			this.textDocument.lineCount > (await this.getDocumentConfiguration()).maxDocumentLines
		)();
	}

	get redactedText() {
		return this._subtractTextFromRanges(this._redactedElements.map(x => x.range));
	}

	async getDocumentConfiguration(): Promise<DocumentSettings> {
		// Get the stored configuration.
		if (this._documentConfiguration) {
			return this._documentConfiguration;
		}
		
		// Get the configuration from the client.
		if (this.workspace.hasConfigurationCapability) {
			this._documentConfiguration = await this.workspace.requestDocumentSettings(this.textDocument.uri);
			if (this._documentConfiguration) {
				return this._documentConfiguration;
			}
		}

		// Use the defaults.
		this._documentConfiguration = {
			maxDocumentLines: 1500,
			maxNumberOfProblems: 100,
			doWarnOptionExplicitMissing: true,
			environment: {
				os: "Win64",
				version: "Vba7"
			}
		};
		return this._documentConfiguration;
	}

	clearDocumentConfiguration = () => this._documentConfiguration = undefined;

	constructor(workspace: Workspace, name: string, document: TextDocument) {
		this.textDocument = document;
		this.workspace = workspace;
		this.name = name;
	}

	static create(workspace: Workspace, document: TextDocument): BaseProjectDocument {
		const slashParts = document.uri.split('/').at(-1);
		const dotParts = slashParts?.split('.');
		const extension = dotParts?.at(-1);
		const filename = dotParts?.join('.');

		if (!filename || !extension) {
			throw new Error("Unable to parse document uri");
		}

		switch (extension) {
			case 'cls':
				return new VbaClassDocument(workspace, filename, document, SymbolKind.Class);
			case 'bas':
				return new VbaModuleDocument(workspace, filename, document, SymbolKind.Class);
			case 'frm':
				return new VbaModuleDocument(workspace, filename, document, SymbolKind.Class);
			default:
				throw new Error("Expected *.cls, *.bas, or *.frm but got *." + extension);
		}
	}

	languageServerSemanticTokens = (range?: Range) => {
		return this._semanticTokens.getSemanticTokens(range);
	};

	languageServerFoldingRanges(): FoldingRange[] {
		return this._foldableElements;
	}

	languageServerSymbolInformation(): SymbolInformation[] {
		return this._symbolInformations;
	}

	languageServerDiagnostics(): DocumentDiagnosticReport {
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: this._hasDiagnosticElements
				.map((e) => e.diagnostics).flat(1)
		};
	}

	async parseAsync(token: CancellationToken): Promise<void> {
		// Handle already cancelled.
		if (token.isCancellationRequested) {
			throw new ParseCancellationException(Error('Parse operation cancelled before it started.'));
		}

		// Listen for cancellation event.
		token.onCancellationRequested(() => {
			throw new ParseCancellationException(new Error('Parse operation cancelled during parse.'));
		})

		// Don't parse oversize documents.
		if (await this.isOversize) {
			console.log(`Document oversize: ${this.textDocument.lineCount} lines.`);
            console.warn(`Syntax parsing has been disabled to prevent crashing.`);
			this._isBusy = false;
			return;
		}

		// Parse the document.
		await (new SyntaxParser()).parseAsync(this)

		// Evaluate the diagnostics.
		this._diagnostics = this._hasDiagnosticElements
			.map(e => e.evaluateDiagnostics())
			.flat();

		this._isBusy = false;
	};

	registerNamedElementDeclaration(element: NamedSyntaxElement) {
		this.workspace.namespaceManager.addNameItem(element);
		return this;
	}

	registerNamespaceElement(element: NamedSyntaxElement) {
		this.workspace.namespaceManager.addNamespace(element);
		return this;
	}

	deregisterScopedElement() {
		this.workspace.namespaceManager.popNamespace();
		return this;
	}

	registerDiagnosticElement(element: HasDiagnosticCapability) {
		this._hasDiagnosticElements.push(element);
		return this;
	}

	/**
	 * Pushes an element to the attribute elements stack.
	 * Be careful to pair a register action with an appropriate deregister.
	 * @param element the element to register.
	 * @returns nothing of interest.
	 */
	// registerAttributeElement = (element: HasAttribute) => {
	// 	this._attributeElements.push(element);
	// 	return this;
	// };

	/**
	 * Pops an element from the attribute elements stack.
	 * Popping allows actions to be performed on the same element,
	 * e.g., registered in the entry event and deregistered in the exit event.
	 * @param element the element to register.
	 * @returns the element at the end of the stack.
	 */
	// deregisterAttributeElement = () => {
	// 	return this._attributeElements.pop();
	// };

	registerFoldableElement = (element: FoldableElement) => {
		this._foldableElements.push(new FoldingRange(element));
		return this;
	};

	/**
	 * Registers a semantic token element for tracking with the SemanticTokenManager.
	 * @param element element The element that has a semantic token.
	 * @returns this for chaining.
	 */
	registerSemanticToken = (element: HasNamedSemanticToken) => {
		this._semanticTokens.add(element);
		return this;
	};

	registerCommentOutElement = (element: HasSemanticToken) => {
		this._semanticTokens.addComment(element);
		return this;
	}

	registerSubtractElement = (element: BaseContextSyntaxElement) => {
		this._redactedElements.push(element);
		return this;
	}

	/**
	 * Registers a SymbolInformation.
	 * @param element The element that has symbol information.
	 * @returns this for chaining.
	 */
	registerSymbolInformation = (element: HasSymbolInformation) => {
		this._symbolInformations.push(element.symbolInformation);
		return this;
	};


	private _subtractTextFromRanges(ranges: Range[]): string {
		const text = this.textDocument.getText();
		return ranges.reduce((x, y) => this._subtractTextRange(x, y), text);
	}

	/**
	 * Subtracts text by replacing it with white space.
	 * @param text the text to act on.
	 * @param range the range to subtract.
	 * @returns the original text with the range replaced by spaces.
	 */
	private _subtractTextRange(text: string, range: Range): string {
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
			return result.join('\r\n')
		}
	}
}


export class VbaClassDocument extends BaseProjectDocument {
	symbolKind: SymbolKind;
	constructor(workspace: Workspace, name: string, document: TextDocument, symbolKind: SymbolKind) {
		super(workspace, name, document);
		this.symbolKind = symbolKind;
	}
}


export class VbaModuleDocument extends BaseProjectDocument {
	symbolKind: SymbolKind;
	constructor(workspace: Workspace, name: string, document: TextDocument, symbolKind: SymbolKind) {
		super(workspace, name, document);
		this.symbolKind = symbolKind;
	}
}
