import { CompletionItem, CompletionParams } from 'vscode-languageserver';
import { ScopeItemCapability } from './capabilities';


/**
 * Extracts the identifier immediately before a `.` on the trigger line.
 * Returns `undefined` when no member-access pattern is found.
 *
 * Examples:
 *   "  MyModule."   → "MyModule"
 *   "  Foo.Bar."    → "Bar"   (last segment before the dot)
 *   "  MySub "      → undefined
 */
function getMemberAccessTarget(lineUpToCursor: string): string | undefined {
	// Match <identifier> immediately before the trailing dot.
	const match = /(\w+)\.$/.exec(lineUpToCursor);
	return match?.[1];
}


/**
 * Resolves completion items for the given LSP completion request.
 *
 * - If the line up to the cursor ends with `<identifier>.` we perform
 *   **member-access completion**: look up the identifier in the project
 *   scope and return its public members.
 * - Otherwise we perform **ambient completion**: return all names that are
 *   accessible from the current module (locals, module-level declarations,
 *   public names from sibling modules, and ambient `.vbatype` items).
 */
export function getCompletionItems(
	params: CompletionParams,
	projectScope: ScopeItemCapability,
	documentText: string
): CompletionItem[] {
	const { position, textDocument } = params;

	// Get the text of the current line up to the cursor character.
	const lines = documentText.split(/\r?\n/);
	const currentLine = lines[position.line] ?? '';
	const lineUpToCursor = currentLine.slice(0, position.character);

	const target = getMemberAccessTarget(lineUpToCursor);

	if (target) {
		// Member-access completion: find the scope for `target` and return its members.
		return resolveMemberAccess(target, textDocument.uri, projectScope);
	}

	// Ambient/in-scope completion.
	return projectScope.getAllAccessibleNames(textDocument.uri);
}


/**
 * Looks up `identifier` starting from the project scope (searching modules,
 * implicit declarations, and the scope chain) and returns the public members
 * of the first match found.
 */
function resolveMemberAccess(
	identifier: string,
	uri: string,
	projectScope: ScopeItemCapability
): CompletionItem[] {
	// Search modules by name first (most common case: `MyModule.`).
	const moduleScopes = projectScope.modules?.get(identifier);
	if (moduleScopes && moduleScopes.length > 0) {
		return moduleScopes[0].getPublicMembers();
	}

	// Search implicit declarations (public names hoisted to project scope).
	const implicitScopes = projectScope.implicitDeclarations?.get(identifier);
	if (implicitScopes && implicitScopes.length > 0) {
		return implicitScopes[0].getPublicMembers();
	}

	// Walk up the scope chain (application/language layers, e.g. .vbatype ambient items).
	let scope = projectScope.parent;
	while (scope) {
		const found = scope.modules?.get(identifier)
			?? scope.implicitDeclarations?.get(identifier);
		if (found && found.length > 0) {
			return found[0].getPublicMembers();
		}
		scope = scope.parent;
	}

	return [];
}
