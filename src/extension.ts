"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
const path = require("path");
const LineByLine = require("n-readlines");
const fileGrep = require("./grep");
const fs = require("fs");
const STATE_KEY = "ctagsSupport";
let navigationHistory = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	//restore previous history
	restoreWorkspaceState(context, STATE_KEY, (val) => {
		try {
			const savedState = JSON.parse(val);
			if (savedState.navigationHistory) {
				navigationHistory = JSON.parse(val).navigationHistory;
			}
		} catch (e) {
			console.log(e);
		}
	});
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "ctags-support" is now active!'
	);

	// The commandId parameter must match the command field in package.json
	const disposableFindTags = vscode.commands.registerCommand(
		"extension.searchCTags",
		() => {
			console.log(
				"Read .tag file from:" +
					path.join(vscode.workspace.rootPath, ".tags")
			);
			const tags = loadTags(
				path.join(vscode.workspace.rootPath, ".tags")
			);
			searchTags(context, tags);
		}
	);

	const disposableShowNavigationHistory = vscode.commands.registerCommand(
		"extension.showNavigationHistory",
		() => {
			vscode.window.showQuickPick(navigationHistory).then((val) => {
				navigateToDefinition(val.filePath, val.pattern);
			});
		}
	);

	const disposableClearAllNavigationHistory = vscode.commands.registerCommand(
		"extension.clearAllNavigationHistory",
		() => {
			navigationHistory = [];
		}
	);

	const disposableClearOneNavigationHistory = vscode.commands.registerCommand(
		"extension.clearOneNavigationHistory",
		() => {
			vscode.window.showQuickPick(navigationHistory).then((val) => {
				navigationHistory = navigationHistory.filter((h: any) => {
					return (
						h.filePath !== val.filePath && h.pattern !== val.pattern
					);
				});
			});
		}
	);

	context.subscriptions.push(disposableFindTags);
	context.subscriptions.push(disposableShowNavigationHistory);
	context.subscriptions.push(disposableClearAllNavigationHistory);
	context.subscriptions.push(disposableClearOneNavigationHistory);
}

function loadTags(tagFilePath) {
	const tags = [];
	const liner = new LineByLine(tagFilePath);
	let line;
	const regExpEscaped = RegExp("[-/\\^$*+?.()|[]{}]", "g");
	while ((line = liner.next())) {
		const elements = line.toString("ascii").split("\t");
		let tagName, fileName;
		const remainingElements = elements.filter((el, index) => {
			if (index === 0) {
				tagName = el;
				return false;
			}
			if (index === 1) {
				fileName = el;
				return false;
			}
			return true;
		});
		const remainingString = remainingElements.join("\t");
		// Strip starting (/^) and ending ($/;") characters from ctags pattern
		const pattern = remainingString.substring(
			remainingString.lastIndexOf("/^") + 2,
			remainingString.lastIndexOf('$/;"')
		);
		// Escape regex pattern and add ^ and $
		// See: https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript/3561711#3561711
		const patternEscaped =
			"^" + pattern.replace(regExpEscaped, "\\$&") + "$";
		tags.push({
			description: "",
			label: tagName,
			detail: fileName,
			filePath: path.join(vscode.workspace.rootPath, fileName),
			pattern: patternEscaped,
		});
	}
	return tags;
}

function searchTags(context: vscode.ExtensionContext, tags: Array<Tags>) {
	const editor = getEditor();
	const query = getSelectedText(editor);

	const displayFiles = tags.filter((tag, index) => {
		return tag.label === query;
	});

	//Case 1. Only one tag found
	if (displayFiles.length === 1) {
		recordHistory(displayFiles[0]);
		saveWorkspaceState(context, STATE_KEY, {
			navigationHistory: navigationHistory,
		});
		navigateToDefinition(displayFiles[0].filePath, displayFiles[0].pattern);
		//Case 2. Many tags found
	} else if (displayFiles.length > 0) {
		vscode.window.showQuickPick(displayFiles).then((val) => {
			recordHistory(val);
			saveWorkspaceState(context, STATE_KEY, {
				navigationHistory: navigationHistory,
			});
			navigateToDefinition(val.filePath, val.pattern);
		});
		//Case 3. No tags found
	} else {
		vscode.window.showInformationMessage(
			"No related tags are found for the ${query}"
		);
	}
}

function recordHistory(visistedFile: any) {
	let isRecorded = false;
	if (navigationHistory.length < 20) {
		navigationHistory.forEach((val) => {
			//if the filePath was already in the Histroy, we will ignore it.
			if (
				val.filePath === visistedFile.filePath &&
				val.pattern === visistedFile.pattern
			) {
				isRecorded = true;
			}
		});
		if (!isRecorded) {
			navigationHistory.push(visistedFile);
		}
	} else {
		navigationHistory.splice(1);
		navigationHistory.push(visistedFile);
	}
}

function navigateToDefinition(filePath: string, pattern: string) {
	vscode.workspace.openTextDocument(filePath).then((d) => {
		vscode.window.showTextDocument(d).then(() => {
			fileGrep(fs.createReadStream(d.fileName), pattern).on(
				"found",
				(lineNumber) => {
					goTolLine(lineNumber);
				}
			);
		});
	});
}

function getEditor(): vscode.TextEditor {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	return editor;
}

function getSelectedText(editor: vscode.TextEditor) {
	const selection = editor.selection;
	let text = editor.document.getText(selection).trim();
	if (!text) {
		const range = editor.document.getWordRangeAtPosition(selection.active);
		text = editor.document.getText(range);
	}
	return text;
}

function goTolLine(line: number) {
	line = line === 0 ? line : line - 1;
	const newSelection = new vscode.Selection(line, 0, line, 0);
	vscode.window.activeTextEditor.selection = newSelection;
	vscode.window.activeTextEditor.revealRange(
		newSelection,
		vscode.TextEditorRevealType.InCenter
	);
}

function saveWorkspaceState(
	context: vscode.ExtensionContext,
	key: string,
	value: any
): void {
	context.workspaceState.update(key, JSON.stringify(value));
}

function restoreWorkspaceState(
	context: vscode.ExtensionContext,
	key: string,
	callback: Function
): void {
	callback(context.workspaceState.get(key, ""));
}

// this method is called when your extension is deactivated
export function deactivate() {}

interface Tags {
	description: string;
	label: string;
	detail: string;
	filePath: string;
	pattern: string;
}
