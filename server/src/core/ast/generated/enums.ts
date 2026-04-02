// Auto-generated - DO NOT EDIT

export enum AssignOp {
  AssignOp_Eq = 0,
  AssignOp_PlusEq = 1,
  AssignOp_MinusEq = 2,
  AssignOp_ShlEq = 3,
  AssignOp_ShrEq = 4,
  AssignOp_OrEq = 5,
  AssignOp_AndEq = 6,
}

export enum ExecKind {
  ExecKind_Body = 0,
  ExecKind_Header = 1,
  ExecKind_Declaration = 2,
  ExecKind_RunStart = 3,
  ExecKind_RunEnd = 4,
  ExecKind_InitDown = 5,
  ExecKind_InitUp = 6,
  ExecKind_PreSolve = 7,
  ExecKind_PostSolve = 8,
}

export enum ExprBinOp {
  BinOp_LogOr = 0,
  BinOp_LogAnd = 1,
  BinOp_BitOr = 2,
  BinOp_BitXor = 3,
  BinOp_BitAnd = 4,
  BinOp_Lt = 5,
  BinOp_Le = 6,
  BinOp_Gt = 7,
  BinOp_Ge = 8,
  BinOp_Exp = 9,
  BinOp_Mul = 10,
  BinOp_Div = 11,
  BinOp_Mod = 12,
  BinOp_Add = 13,
  BinOp_Sub = 14,
  BinOp_Shl = 15,
  BinOp_Shr = 16,
  BinOp_Eq = 17,
  BinOp_Ne = 18,
}

export enum ExprUnaryOp {
  UnaryOp_Plus = 0,
  UnaryOp_Minus = 1,
  UnaryOp_LogNot = 2,
  UnaryOp_BitNeg = 3,
  UnaryOp_BitAnd = 4,
  UnaryOp_BitOr = 5,
  UnaryOp_BitXor = 6,
}

export enum StringMethodId {
  StringMethod_None = 0,
  StringMethod_Size = 1,
  StringMethod_Find = 2,
  StringMethod_FindLast = 3,
  StringMethod_FindAll = 4,
  StringMethod_Lower = 5,
  StringMethod_Upper = 6,
  StringMethod_Split = 7,
  StringMethod_Chars = 8,
}

export enum ExtendTargetE {
  Action = 0,
  Annotation = 1,
  Buffer = 2,
  Component = 3,
  Enum = 4,
  Resource = 5,
  State = 6,
  Stream = 7,
  Struct = 8,
}

export enum ParamDir {
  ParamDir_Default = 0,
  ParamDir_In = 1,
  ParamDir_Out = 2,
  ParamDir_InOut = 3,
}

export enum PlatQual {
  PlatQual_None = 0,
  PlatQual_Target = 1,
  PlatQual_Solve = 2,
}

export enum FunctionParamDeclKind {
  ParamKind_DataType = 0,
  ParamKind_Type = 1,
  ParamKind_RefAction = 2,
  ParamKind_RefComponent = 3,
  ParamKind_RefBuffer = 4,
  ParamKind_RefResource = 5,
  ParamKind_RefState = 6,
  ParamKind_RefStream = 7,
  ParamKind_RefStruct = 8,
  ParamKind_Struct = 9,
}

export enum SymbolRefPathElemKind {
  ElemKind_ChildIdx = 0,
  ElemKind_ArgIdx = 1,
  ElemKind_Inline = 2,
  ElemKind_ParamIdx = 3,
  ElemKind_Super = 4,
  ElemKind_TypeSpec = 5,
}

export enum StructKind {
  Buffer = 0,
  Struct = 1,
  Resource = 2,
  Stream = 3,
  State = 4,
}

export enum TypeCategory {
  Action = 0,
  Component = 1,
  Buffer = 2,
  Resource = 3,
  State = 4,
  Stream = 5,
  Struct = 6,
}

