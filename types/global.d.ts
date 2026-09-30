// For pages that load dist/validator.min.js with a <script> tag: FormValidator and FileValidator are globals.
// Add to your project:  /// <reference types="form-and-file-validator/types/global" />
declare const FormValidator: import('./formValidator').FormValidatorStatic;
declare const FileValidator: import('./fileValidator').FileValidatorStatic;
declare const FVLocales: import('./locales').LocalesStatic;
