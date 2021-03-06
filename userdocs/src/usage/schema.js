/*
Copyright 2019 The Skaffold Authors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Modifications:
  Copyright 2020 Weaveworks
*/

import { html, render } from "https://unpkg.com/lit-html@1.2.1/lit-html.js";
import { unsafeHTML } from "https://unpkg.com/lit-html@1.2.1/directives/unsafe-html.js";

(async function () {
    const table = document.getElementById("config");
    const response = await fetch(`../schema.json`);
    const json = await response.json();

    render(
        html` ${template(json.definitions, undefined, json.$ref, 0, "")} `,
        table
    );

    if (location.hash) {
        table.querySelector(location.hash).scrollIntoView();
    }
})();

function offset(ident) {
    return `${ident * 2}ex`;
}
function* template(definitions, parentDefinition, ref, ident, parent) {
    const name = ref.replace("#/definitions/", "");
    const allProperties = [];
    const seen = {};

    for (const key of definitions[name].preferredOrder || []) {
        allProperties.push([key, definitions[name].properties[key]]);
        seen[key] = true;
    }

    let index = -1;
    for (let [key, definition] of allProperties) {
        const path = parent.length == 0 ? key : `${parent}-${key}`;
        index++;

        // Key
        const required =
            definitions[name].required &&
            definitions[name].required.includes(key);
        let keyClass = required ? "key required" : "key";

        // Value
        let value = definition.default;
        if (definition.examples && definition.examples.length > 0) {
            value = definition.examples[0];
        }
        const valueClass = definition.examples ? "example" : "value";

        // Description
        let desc = definition["x-intellij-html-description"] || "";

        let firstOfListType = undefined;
        if (parentDefinition && parentDefinition.type === "array") {
            firstOfListType = index === 0;
        }
        const keyCell = (value) => html`
            <td>
                <div class="anchor" id="${path}"></div>
                <span class="${keyClass}" style="margin-left: ${offset(ident)}">
                    ${anchor(path, key, firstOfListType)}:
                </span>
                <span class="${valueClass}">${value}</span>
            </td>
        `;
        if (definition.$ref) {
            // Check if the referenced description is a final one
            const refName = definition.$ref.replace("#/definitions/", "");
            const refDef = definitions[refName];
            let type = "";
            if (refDef.type === "object") {
                if (!refDef.properties && !refDef.anyOf) {
                    type = "object";
                    value = "{}";
                }
            } else {
                type = refDef.type;
            }
            if (desc === "") {
                desc = refDef["x-intellij-html-description"] || "";
            }

            yield html`
                <tr class="top">
                    ${keyCell(value)}
                    <td class="type">${type}</td>
                    <td class="comment">${unsafeHTML(desc)}</td>
                </tr>
            `;
        } else if (definition.items && definition.items.$ref) {
            const refName = definition.items.$ref.replace("#/definitions/", "");
            const refDef = definitions[refName];
            let type = "";
            if (refDef.type === "object") {
                if (!refDef.properties && !refDef.anyOf) {
                    type = "object[]";
                    value = "{}";
                }
            } else {
                type = refDef.type;
            }
            if (desc === "") {
                desc = refDef["x-intellij-html-description"] || "";
            }
            yield html`
                <tr class="top">
                    ${keyCell(value)}
                    <td class="type">${type}</td>
                    <td class="comment">${unsafeHTML(desc)}</td>
                </tr>
            `;
        } else if (definition.type === "array" && value && value !== "[]") {
            // Parse value to json array
            const values = JSON.parse(value);

            yield html`
                <tr>
                    ${keyCell("")}
                    <td class="type"></td>
                    <td class="comment" rowspan="${1 + values.length}">
                        ${unsafeHTML(desc)}
                    </td>
                </tr>
            `;

            for (const v of values) {
                yield html`
                    <tr>
                        <td>
                            <span
                                class="key"
                                style="margin-left: ${offset(ident)}"
                                >- <span class="${valueClass}">${v}</span></span
                            >
                        </td>
                        <td class="type">object</td>
                        <td class="comment"></td>
                    </tr>
                `;
            }
        } else if (definition.type === "object" && value && value !== "{}") {
            yield html`
                <tr>
                    ${keyCell(value)}
                    <td class="type">object</td>
                    <td class="comment">${unsafeHTML(desc)}</td>
                </tr>
            `;
        } else {
            const type =
                definition.type === "array"
                    ? `${definition.items.type}[]`
                    : definition.type;
            yield html`
                <tr>
                    ${keyCell(value)}
                    <td class="type">${type}</td>
                    <td class="comment">${unsafeHTML(desc)}</td>
                </tr>
            `;
        }

        // This definition references another definition
        if (definition.$ref) {
            yield html`
                ${template(
                    definitions,
                    definition,
                    definition.$ref,
                    ident + 2,
                    path
                )}
            `;
        }

        // This definition is an array
        if (definition.items && definition.items.$ref) {
            yield html`
                ${template(
                    definitions,
                    definition,
                    definition.items.$ref,
                    ident + 2,
                    path
                )}
            `;
        }
    }
}

function anchor(path, label, firstOfListType) {
    let listPrefix = "";
    if (firstOfListType !== undefined) {
        listPrefix = html`<span
            style="visibility: ${firstOfListType ? "visible" : "hidden"}"
            >-
        </span>`;
    }
    const anchor = html`<a class="key" href="#${path}">${label}</a>`;
    return html`${listPrefix}${anchor}`;
}
