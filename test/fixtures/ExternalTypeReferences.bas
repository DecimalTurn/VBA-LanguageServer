Attribute VB_Name = "ExternalTypeReferences"
'''
' Test file for external type references like COM objects, DLL types, etc.
'''

Option Explicit

' External type references that should be handled gracefully by the parser
Public componentsToImport As Dictionary ' Key = componentName, Value = componentFilePath
Private objExcel As Excel.Application
Private objWord As Word.Application
Dim xmlDoc As MSXML2.DOMDocument60
Public fileSystem As Scripting.FileSystemObject

' Function using external types
Public Function ProcessDictionary(data As Dictionary) As Collection
    Dim result As Collection
    Set result = New Collection

    Dim key As Variant
    For Each key In data.Keys
        result.Add data(key)
    Next key

    Set ProcessDictionary = result
End Function

' Sub using external COM object
Public Sub ProcessExcelFile(workbook As Excel.Workbook)
    Dim worksheet As Excel.Worksheet
    Set worksheet = workbook.Worksheets(1)

    worksheet.Cells(1, 1).Value = "Test"
End Sub
