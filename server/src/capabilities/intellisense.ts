// The purpose of this file is to help provide IntelliSense for VBA code 
// Since we are using an LSP, we can take advantage of that and don't have to use registerCompletionItemProvider.
// Instead, we rely on the type analysis done by the LSP of the files located on the client by copying the content of ../types/*.d.vba files onto the client.

import { InitializeResult } from 'vscode-languageserver'; // Import the correct type
import * as fs from 'fs';
import * as path from 'path';

export function activateIntellisense(result: InitializeResult) {
    
    result.capabilities.completionProvider = {
        resolveProvider: true,
        triggerCharacters: ['.']
    };

    // Copy the content of the types folder to the client
    // This is a simple way to provide IntelliSense for VBA code
    // The client will have to parse the files and provide IntelliSense based on the content of the files
    const typesFolderPath = path.resolve(__dirname, '../types');
    const files = fs.readdirSync(typesFolderPath);

    const typeFilesContent: Record<string, string> = {};

    files.forEach((file) => {
        if (file.endsWith('.d.vba')) {
            const filePath = path.join(typesFolderPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            typeFilesContent[file] = content;
        }
    });

    // Send the type files' content to the client
    // Assuming there's a mechanism to send this data to the client (e.g., through a custom LSP request)
    sendTypeFilesToClient(typeFilesContent);
}

// Function to send the type files' content to the client
function sendTypeFilesToClient(typeFilesContent: Record<string, string>) {
    // This function should implement the logic to send the type files' content to the client.
    // For example, you can use a custom LSP request to transfer the data.
    console.log('Sending type files to client:', typeFilesContent);
    // Replace the above console.log with actual logic to send the data to the client.
    //fs.writeFileSync(path.resolve(__dirname, '../client/types.vba'), JSON.stringify(typeFilesContent));

}
