/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
'use strict';

const expandLocales = require('./lib/expand-locales');
const extractPluralRules = require('./lib/extract-plurals');
const getAllLocales = require('./lib/locales').getAllLocales;
const extractRelativeFields = require('./lib/extract-relative');

function mergeData(/*...sources*/) {
    let sources = [].slice.call(arguments);

    return sources.reduce(function (data, source) {
        Object.keys(source || {}).forEach(function (locale) {
            data[locale] = Object.assign(data[locale] || {}, source[locale]);
        });

        return data;
    }, {});
}

function extractData(options) {
    options = Object.assign({
        locales       : null,
        pluralRules   : false,
        relativeFields: false,
    }, options);

    // Default to all CLDR locales if none have been provided.
    let locales = options.locales || getAllLocales();

    // Each type of data has the structure: `{"<locale>": {"<key>": <value>}}`,
    // which is well suited for merging into a single object per locale. This
    // performs that deep merge and returns the aggregated result.
    const output = mergeData(
        expandLocales(locales),
        options.pluralRules && extractPluralRules(locales),
        options.relativeFields && extractRelativeFields(locales)
    );

    return output;
}

module.exports = extractData;