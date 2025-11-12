Attribute VB_Name = "TestUnicode"
Option Explicit

' Test Unicode identifiers and underscore validation
Public Sub TestIdentifiers()
    ' Valid identifiers with Unicode characters
    Dim café As String
    Dim naïve As String
    Dim résumé As String
    Dim François As String
    Dim Müller As String
    
    ' Valid identifiers with underscores (but not starting with them)
    Dim my_variable As String
    Dim test_123 As String
    Dim value_with_underscores As String
    
    ' The following would be invalid (cannot start with underscore):
    ' Dim _invalid As String  ' This should be flagged as invalid
    
    ' Test function with Unicode name
    Call testFonction(café, résumé)
    
    ' Test assignment
    café = "coffee"
    naïve = "naive"
    résumé = "resume"
    François = "Francis"
    Müller = "Miller"
End Sub

Private Function testFonction(ByVal paramètre As String, ByVal résultat As String) As String
    testFonction = paramètre & " " & résultat
End Function