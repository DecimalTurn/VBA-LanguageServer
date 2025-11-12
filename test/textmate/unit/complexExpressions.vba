'  SYNTAX TEST "source.vba" "complex expressions and functions"

' Test complex expression parsing, function parameters, and function body recognition
' These tests reveal broader parsing issues that affect both ASCII and Unicode identifiers

Sub TestComplexExpressions()
    Dim café As String
    Dim result As String

    ' Complex expression with comparison operator and string literals
    If café = "coffee" Then
'      ^^^^                               variable.other.readwrite.vba
'            ^                            keyword.operator.comparison.vba
'              ^^^^^^^^                   string.quoted.double.vba
        result = café & " and " & "more"
'       ^^^^^^                             variable.other.readwrite.vba
'                ^^^^                      variable.other.readwrite.vba
'                     ^                    keyword.operator.concatenation.vba
'                       ^^^^^^^            string.quoted.double.vba
'                               ^          keyword.operator.concatenation.vba
'                                 ^^^^^^   string.quoted.double.vba
    End If

    ' Test with ASCII for comparison
    Dim foo As String
    If foo = "test" Then
'      ^^^                                 variable.other.readwrite.vba
'          ^                               keyword.operator.comparison.vba
'            ^^^^^^                        string.quoted.double.vba
        result = foo & " and " & "more"
'       ^^^^^^                             variable.other.readwrite.vba
'                ^^^                       variable.other.readwrite.vba
'                    ^                     keyword.operator.concatenation.vba
'                      ^^^^^^^             string.quoted.double.vba
'                              ^           keyword.operator.concatenation.vba
'                                ^^^^^^    string.quoted.double.vba
    End If
End Sub

' Test function parameter recognition with Unicode identifiers
Private Function testFonction(ByVal paramètre As String, ByVal résultat As String) As String
'                                   ^^^^^^^^^^                   ^^^^^^^^            variable.parameter.vba
    ' Test function name recognition in function body
    testFonction = paramètre & " " & résultat
'   ^^^^^^^^^^^^                             entity.name.function.vba
'                  ^^^^^^^^^^                variable.other.readwrite.vba
'                             ^^^             string.quoted.double.vba
'                                   ^^^^^^^^  variable.other.readwrite.vba
End Function

' Test with ASCII function for comparison
Private Function testFunction(ByVal parameter As String, ByVal result As String) As String
'                                   ^^^^^^^^^                  ^^^^^^            variable.parameter.vba
    testFunction = parameter & " " & result
'   ^^^^^^^^^^^^                           entity.name.function.vba
'                  ^^^^^^^^^               variable.other.readwrite.vba
'                            ^^^           string.quoted.double.vba
'                                ^^^^^^    variable.other.readwrite.vba
End Function
