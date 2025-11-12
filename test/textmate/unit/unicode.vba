'  SYNTAX TEST "source.vba" "unicode identifiers"

' Test Unicode identifier support with accented characters

Sub TestUnicode()
    Dim café As String
'       ^^^^                              variable.other.readwrite.vba
    Dim naïve As String
'       ^^^^^                             variable.other.readwrite.vba
    Dim résumé As String
'       ^^^^^^                            variable.other.readwrite.vba
    Dim François As String
'       ^^^^^^^^                          variable.other.readwrite.vba
    Dim Müller As String
'       ^^^^^^                            variable.other.readwrite.vba

    café = "coffee"
'   ^^^^                                  variable.other.readwrite.vba
'          ^^^^^^^^                       string.quoted.double.vba
    naïve = "naive"
'   ^^^^^                                 variable.other.readwrite.vba
'           ^^^^^^^                       string.quoted.double.vba
    résumé = "resume"
'   ^^^^^^                                variable.other.readwrite.vba
'            ^^^^^^^^                     string.quoted.double.vba
    François = "Francis"
'   ^^^^^^^^                              variable.other.readwrite.vba
'              ^^^^^^^^^                  string.quoted.double.vba

    ' Function call with Unicode parameter
    Call testFonction(café, résumé)
'        ^^^^^^^^^^^^                     entity.name.function.call.vba
'                     ^^^^                variable.other.readwrite.vba
'                           ^^^^^^        variable.other.readwrite.vba

    ' Unicode variable in expression
    If café = "coffee" Then
'      ^^^^                               variable.other.readwrite.vba
'            ^                            keyword.operator.comparison.vba
'              ^^^^^^^^                   string.quoted.double.vba
        résumé = café & " and " & François
'       ^^^^^^                             variable.other.readwrite.vba
'                ^^^^                      variable.other.readwrite.vba
'                     ^                    keyword.operator.concatenation.vba
'                             ^           keyword.operator.concatenation.vba
'                               ^^^^^^^^   variable.other.readwrite.vba
    End If

    ' Valid underscored identifiers (not starting with underscore)
    Dim my_café As String
'       ^^^^^^^                           variable.other.readwrite.vba
    Dim test_résumé As String
'       ^^^^^^^^^^^                       variable.other.readwrite.vba

    my_café = café
'   ^^^^^^^                               variable.other.readwrite.vba
'             ^^^^                        variable.other.readwrite.vba
End Sub

Private Function testFonction(ByVal paramètre As String, ByVal résultat As String) As String
'                                   ^^^^^^^^^^                   ^^^^^^^^            variable.parameter.vba
    testFonction = paramètre & " " & résultat
'   ^^^^^^^^^^^^                             entity.name.function.vba
'                  ^^^^^^^^^^                variable.other.readwrite.vba
'                                   ^^^^^^^^  variable.other.readwrite.vba
End Function
