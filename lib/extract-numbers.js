/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
'use strict';

var p = require('path');

var getParentLocale = require('./locales').getParentLocale;
var hasNumberFields   = require('./locales').hasNumberFields;
var normalizeLocale = require('./locales').normalizeLocale;

// The set of CLDR date field names that are used in FormatJS.
var NUMBER_FIELD_NAMES = [
    'decimalFormats-numberSystem-latn',
    'currencyFormats-numberSystem-latn',
];

module.exports = function extractNumberFields(locales) {
    // The CLDR states that the "root" locale's data should be used to fill in
    // any missing data as its data is the default.
    var defaultFields = loadNumberFields('root');

    var fields = {};
    var hashes = {};

    // Loads and caches the relative fields for a given `locale` because loading
    // and transforming the data is expensive.
    function getNumberFields(locale) {
        var relativeFields = fields[locale];
        if (relativeFields) {
            return relativeFields;
        }

        if (hasNumberFields(locale)) {
            relativeFields = fields[locale] = loadNumberFields(locale);
            return relativeFields;
        }
    }

    // Hashes and caches the `fields` for a given `locale` to avoid hashing more
    // than once since it could be expensive.
    function hashFields(locale, fields) {
        var hash = hashes[locale];
        if (hash) {
            return hash;
        }

        hash = hashes[locale] = JSON.stringify(fields);
        return hash;
    }

    // We want to de-dup data that can be referenced from upstream in the
    // `locale`'s hierarchy when that locale's relative fields are the _exact_
    // same as one of its ancestors. This will traverse the hierarchy for the
    // given `locale` until it finds an ancestor with same same relative fields.
    // When an ancestor can't be found, a data entry must be created for the
    // `locale` since its relative fields are unique.
    function findGreatestAncestor(locale) {
        // The "root" locale is not a suitable ancestor, because there won't be
        // an entry for "root" in the final data object.
        var parentLocale = getParentLocale(locale);
        if (!parentLocale || parentLocale === 'root') {
            return locale;
        }

        // When the `locale` doesn't have fields data, we need to traverse up
        // its hierarchy to find suitable relative fields data.
        if (!hasNumberFields(locale)) {
            return findGreatestAncestor(parentLocale);
        }

        var fields;
        var parentFields;
        if (hasNumberFields(parentLocale)) {
            fields       = getNumberFields(locale);
            parentFields = getNumberFields(parentLocale);

            // We can only use this ancestor's fields if they hash to the
            // _exact_ same value as `locale`'s fields. If the ancestor is
            // suitable, we keep looking up its hierarchy until the relative
            // fields are determined to be unique.
            if (hashFields(locale, fields) ===
                hashFields(parentLocale, parentFields)) {

                return findGreatestAncestor(parentLocale);
            }
        }

        return locale;
    }

    return locales.reduce(function (numberFields, locale) {
        // Walk the `locale`'s hierarchy to look for suitable ancestor with the
        // _exact_ same relative fields. If no ancestor is found, the given
        // `locale` will be returned.
        locale = findGreatestAncestor(normalizeLocale(locale));

        // The "root" locale is ignored because the built-in `Intl` libraries in
        // JavaScript have no notion of a "root" locale; instead they use the
        // IANA Language Subtag Registry.
        if (locale === 'root') {
            return numberFields;
        }

        // Add an entry for the `locale`, which might be an ancestor. If the
        // locale doesn't have relative fields, then we fallback to the "root"
        // locale's fields.
        numberFields[locale] = {
            numbers: getNumberFields(locale) || defaultFields,
        };

        return numberFields;
    }, {});
};

function loadNumberFields(locale) {
    var locale   = normalizeLocale(locale);
    var filename = p.join('cldr-numbers-full', 'main', locale, 'numbers.json');
    var fields   = require(filename).main[locale].numbers;
    // Reduce the number fields data down to whitelist of fields needed in the
    // FormatJS libs.
    return NUMBER_FIELD_NAMES.reduce(function (relative, field) {
        relative[field] = fields[field];
        return relative;
    }, {});
}
