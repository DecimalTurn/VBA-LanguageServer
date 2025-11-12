Sub TestUnicodeIdentifiers()
    Dim café As String
    Dim naïve As String  
    Dim résumé As String
    
    café = "hello"
    naïve = "world"
    
    For i = 1 To 10
        résumé = café & naïve
    Next i
End Sub