grammar vbapre;

options {
    caseInsensitive = true;
}

// PARSER RULES
startRule
    : document EOF
    // : anyOtherLine EOF
    ;

document
    : (documentLines | compilerIfBlock)*
    ;

documentLines
    : (anyOtherLine | endOfLine)+
    ;

compilerIfBlock
    : compilerConditionalBlock+
        compilerDefaultBlock?
        compilerEndIfStatement
    ;

compilerConditionalBlock
    : compilerConditionalStatement compilerBlockContent?
    ;

compilerDefaultBlock
    : compilerElseStatement compilerBlockContent?
    ;
    
compilerConditionalStatement
    : compilerIfStatement
    | compilerElseIfStatement
    ;

compilerIfStatement
    : WS? IF WS? booleanExpression WS? THEN endOfStatement
    ;

compilerElseIfStatement
    : WS? ELSEIF WS? booleanExpression WS? THEN endOfStatement
    ;

compilerElseStatement
    : WS? ELSE endOfStatement
    ;

compilerEndIfStatement
    : WS? ENDIF endOfStatement?
    ;

compilerBlockContent
    : (anyOtherLine | endOfLine | compilerIfBlock)+
    ;

// *************************

booleanExpression
    : booleanPart+
    ;

booleanPart
    : WS? (AND | OR | XOR | EQV | IMP)? WS? NOT? WS? (compilerConstant | anyWord)
    ;

compilerConstant
    : VBA6
    | VBA7
    | WIN16
    | WIN32
    | WIN64
    | MAC
    ;

anyWord
    : ANYCHARS+
    ;

anyOtherLine
    : (WS* anyWord)+
    ;

endOfLine
    : (WS* (NEWLINE | commentBody | remStatement))+
    ;

endOfLineNoWs
    : (NEWLINE | commentBody | remStatement)
    ;

endOfStatement
    : (endOfLine | WS? COLON WS? )+
    ;

commentBody: COMMENT;
remStatement: REMCOMMENT;

// wsc: (WS | LINE_CONTINUATION)+;




// LEXER RULES

NEWLINE
    // Match at least one new line but then any number
    // of blank lines, including white space.
    : ([\r\n\u2028\u2029]) (WS* ([\r\n\u2028\u2029]))*
    ;

ELSE
    : '#ELSE'
    ;

ELSEIF
    : '#ELSE IF'
    ;

ENDIF
    : '#END IF'
    ;

IF
    : '#IF'
    ;

THEN
    : 'THEN'
    ;

VBA6
    : 'VBA6'
    ;
    
VBA7
    : 'VBA7'
    ;
    
WIN16
    : 'WIN16'
    ;
    
WIN32
    : 'WIN32'
    ;
    
WIN64
    : 'WIN64'
    ;
    
MAC
    : 'MAC'
    ;

REMCOMMENT
    : COLON? REM WS (LINE_CONTINUATION | ~[\r\n\u2028\u2029])*
    ;

COMMENT
    : SINGLEQUOTE (LINE_CONTINUATION | ~[\r\n\u2028\u2029])*
    ;

LINE_CONTINUATION
    : WS UNDERSCORE WS? '\r'? '\n' -> channel(HIDDEN)
    ;

WS
    : NBSP+
    ;

fragment NBSP
    : [ \t\u0019\u3000]
    ;

fragment UNDERSCORE
    : '_'
    ;

COLON
    : ':'
    ;

SINGLEQUOTE
    : '\''
    ;

REM
    : 'REM'
    ;

EQV
    : 'EQV'
    ;

IMP
    : 'IMP'
    ;

AND
    : 'AND'
    ;

OR
    : 'OR'
    ;

XOR
    : 'XOR'
    ;

NOT
    : 'NOT'
    ;


// Any non-whitespace or new line characters.
ANYCHARS
    : ANYCHAR+
    ;

fragment ANYCHAR
    : ~[\r\n\u2028\u2029 \t\u0019\u3000]
    ;