import * as similarity from 'string-similarity';
import { clean, removeSpecialChars, transformSpecificVariations } from './title';

const defaultThreshold = 0.9;

const matchers = [
    ["Case-Insensitive raw string", s => s.toLowerCase(), s => s.toLowerCase()],
    ["Remove \"season\" and trim space for first string and remove \"Xth Season\" for second string", s => s.replaceAll("season", "").replaceAll("  ", " ").trimEnd(), s => clean(s).trimEnd()],
    ["Remove special characters for first string", s => removeSpecialChars(s), s => s],
    ["Remove special characters for second string", s => s, s => removeSpecialChars(s)],
    ["Remove special characters for both strings", s => removeSpecialChars(s), s => removeSpecialChars(s)],
    ["Remove special characters for both strings, in addition to fixing phonetic variations", s => removeSpecialChars(transformSpecificVariations(s)), s => removeSpecialChars(transformSpecificVariations(s))],
    ["Remove \"Xth Season\" for first string", s => clean(s), s => s],
    ["Remove \"Xth Season\" for second string", s => s, s => clean(s)],
    ["Remove \"Xth Season\" for both strings", s => clean(s), s => clean(s)],
    ["Remove \"Xth Season\" for both strings, in addition to trimming spaces", s => clean(s), s => clean(s)],
];

export function deepMatch(a, b, fuzzy = true, threshold = defaultThreshold) {
    let pass = false;

    a = a.toLowerCase();
    b = b.toLowerCase();

    if (fuzzy) {
        for (let matcher of matchers) {
            const [name, transformerA, transformerB] = matcher;

            if (typeof transformerA === "string" || typeof transformerB === "string") continue;

            const similarityValue = similarity.compareTwoStrings(transformerA(a), transformerB(b));

            if (similarityValue >= threshold) {
                pass = true;
                break;
            }
        }
    } else {
        if (a.toLowerCase() === b.toLowerCase()) pass = true;
        else if (a.replaceAll("season", "").replaceAll("  ", " ").trimEnd() === clean(b).trimEnd()) pass = true;
        else if (removeSpecialChars(a) === removeSpecialChars(b)) pass = true;
        else if (removeSpecialChars(transformSpecificVariations(a)) === removeSpecialChars(transformSpecificVariations(b))) pass = true;
    }

    return pass;
}