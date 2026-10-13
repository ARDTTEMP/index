export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s]).{8,128}';
export const passwordValid = (value: string) => value.length >= 8 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9\s]/.test(value);
export const passwordHelp = {fr: '8 caractères minimum : une majuscule, une minuscule, un chiffre et un symbole (ex. !, @, #).', en: 'At least 8 characters: one uppercase letter, one lowercase letter, one digit and one symbol (e.g. !, @, #).'};
