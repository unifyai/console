
/* eslint-disable no-unused-vars */
declare module "postman-code-generators" {
    /**
     * Gets the options specific to a given language.
     *
     * @param {Object} language - language key provided by getLanguageList function
     * @param {Array} variant - variant key provided by getLanguageList function
     * @param {Function} callback - callback function with arguments (error, object)
     */
    export function getOptions(language: any, variant: any[], callback: Function): void;

    export interface Language {
        key: string;
        label: string;
        syntax_mode: string;
        variants: {
            key: string;
        }[];
    }

    /**
     * Returns an object of supported languages
     *
     */
    export function getLanguageList(): Language[];
    /**
     * Converts a request to a preferred language snippet
     *
     * @param {Object} language - language key provided by getLanguageList function
     * @param {Array} variant - variant key provided by getLanguageList function
     * @param {String} request -  valid postman request
     * @param {Object} [options] - contains convert level options
     * @param {Number} [options.indentType] - indentation based on Tab or spaces
     * @param {Number} [options.indentCount] - count/frequency of indentType
     * @param {Number} [options.requestTimeout] : time in milli-seconds after which request will bail out
     * @param {Boolean} [options.trimRequestBody] : whether to trim request body fields
     * @param {Boolean} [options.addCacheHeader] : whether to add cache-control header to postman SDK-request
     * @param {Boolean} [options.followRedirect] : whether to allow redirects of a request
     * @param {Function} callback - callback function with arguments (error, string)
     */
    export function convert(
        language: string, 
        variant: string, 
        request: any, 
        options: {
            indentType?: number;
            indentCount?: number;
            requestTimeout?: number;
            trimRequestBody?: boolean;
            addCacheHeader?: boolean;
            followRedirect?: boolean;
        },
        callback: (err: any, code: string) => void,
        ): any;
}

