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

    ' Valid underscored identifiers (not starting with underscore)
    Dim my_café As String
'       ^^^^^^^                           variable.other.readwrite.vba
    Dim test_résumé As String
'       ^^^^^^^^^^^                       variable.other.readwrite.vba

    my_café = café
'   ^^^^^^^                               variable.other.readwrite.vba
'             ^^^^                        variable.other.readwrite.vba
End Sub
