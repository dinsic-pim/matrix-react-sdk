/*
Copyright 2017 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Regenerates the translations base file by walking the source tree and
 * parsing each file with flow-parser. Emits a JSON file with the
 * translatable strings mapped to themselves in the order they appeared
 * in the files and grouped by the file they appeared in.
 *
 * Usage: node scripts/gen-i18n.js
 */
const fs = require('fs');
const path = require('path');

const walk = require('walk');

const flowParser = require('flow-parser');
const estreeWalker = require('estree-walker');

const TRANSLATIONS_FUNCS = ['_t', '_td', '_tJsx'];

// A selection of plural variants to put in the base file: other langauges
// with more types of plural will have more, but they will just be in the file
// for that language.
const COUNTSTRINGS = ['one', 'other'];

const FLOW_PARSER_OPTS = {
  esproposal_class_instance_fields: true,
  esproposal_class_static_fields: true,
  esproposal_decorators: true,
  esproposal_export_star_as: true,
  types: true,
};

function getObjectValue(obj, key) {
    for (const prop of obj.properties) {
        if (prop.key.type == 'Identifier' && prop.key.name == key) {
            return prop.value;
        }
    }
    return null;
}

function getTKey(arg) {
    if (arg.type == 'Literal') {
        return arg.value;
    } else if (arg.type == 'BinaryExpression' && arg.operator == '+') {
        return getTKey(arg.left) + getTKey(arg.right);
    } else if (arg.type == 'TemplateLiteral') {
        return arg.quasis.map((q) => {
            return q.value.raw;
        }).join('');
    }
    return null;
}

function getTranslations(file) {
    const tree = flowParser.parse(fs.readFileSync(file, { encoding: 'utf8' }), FLOW_PARSER_OPTS)

    const trs = new Set();

    estreeWalker.walk(tree, {
        enter: function(node, parent) {
            //console.log(node);
            if (
                node.type == 'CallExpression' &&
                TRANSLATIONS_FUNCS.includes(node.callee.name)
            ) {
                const tKey = getTKey(node.arguments[0]);
                if (tKey === null) return;

                let isPlural = false;
                if (node.arguments.length > 1 && node.arguments[1].type == 'ObjectExpression') {
                    const countVal = getObjectValue(node.arguments[1], 'count');
                    if (countVal) {
                        isPlural = true;
                    }
                }

                if (isPlural) {
                    for (const s of COUNTSTRINGS) {
                        trs.add(tKey + "|" + s);
                    }
                } else {
                    trs.add(tKey);
                }
            }
        }
    });

    return trs;
}

const translatables = new Set();

walk.walkSync("src", {
    listeners: {
        file: function(root, fileStats, next) {
            if (!fileStats.name.endsWith('.js')) return;

            const fullPath = path.join(root, fileStats.name);
            const trs = getTranslations(fullPath);
            console.log(`${fullPath} (${trs.size} strings)`);
            for (const tr of trs.values()) {
                translatables.add(tr);
            }
        },
    }
});

const trObj = {};
for (const tr of translatables) {
    trObj[tr] = tr;
}

fs.writeFileSync(
    "src/i18n/strings/en_EN.json",
    JSON.stringify(trObj, translatables.values(), 4) + "\n"
);
