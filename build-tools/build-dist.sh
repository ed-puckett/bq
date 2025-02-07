#!/bin/bash

declare THIS_FILE=${BASH_SOURCE##*/}
declare THIS_FILE_DIR=$([[ -z "${BASH_SOURCE%/*}" ]] && echo '' || { cd "${BASH_SOURCE%/*}"; pwd; })

declare COPY_ONLY_KEYWORD=copy-only

if [[ $# -gt 2 || ( $# == 2 && "$2" != "${COPY_ONLY_KEYWORD}" ) ]]; then
    echo 1>&2 "usage: ${THIS_FILE} {version_dir} [ ${COPY_ONLY_KEYWORD} ]"
    exit 1
fi

declare version_dir=$1
if [[ "${version_dir}" =~ [/:@*[:space:]] ]]; then
    echo 1>&2 "** version_dir contains illegal characters"
    exit 1
fi

declare copy_only=
if [[ "$2" == "${COPY_ONLY_KEYWORD}" ]]; then
   copy_only=true
fi

set -e  # abort on error

declare THIS_FILE=${BASH_SOURCE##*/}
declare THIS_FILE_DIR=$([[ -z "${BASH_SOURCE%/*}" ]] && echo '' || { cd "${BASH_SOURCE%/*}"; pwd; })

declare ROOT_DIR="${THIS_FILE_DIR}/.."
declare DIST_VERSIONS_DIR="${ROOT_DIR}/dist"
declare DIST_DIR="${DIST_VERSIONS_DIR}/${version_dir}"

declare -a FILES_TO_COPY=(
    'LICENSE'
    'README.md'
    'src/bq-bootstrap.js'
    'src/index.html'
    'src/favicon.ico'
    'src/renderer/text/javascript-renderer/eval-worker/web-worker.js'
    'node_modules/sprintf-js/dist/sprintf.min.js'
    'node_modules/sprintf-js/dist/sprintf.min.js.map'
    'node_modules/marked/marked.min.js'
    'node_modules/rxjs/dist/bundles/rxjs.umd.min.js'
    'node_modules/rxjs/dist/bundles/rxjs.umd.min.js.map'
    'node_modules/d3/dist/d3.min.js'
    'node_modules/plotly.js-dist/plotly.js'
    'node_modules/@hpcc-js/wasm/dist/graphviz.umd.js'
    'node_modules/d3-graphviz/build/d3-graphviz.min.js'
    'node_modules/algebrite/dist/algebrite.bundle-for-browser.js'
)

declare -a DIRECTORIES_TO_COPY=(
#   ---directory---                --- destination--- <<< (pairs of entries)
    'node_modules/katex/dist'      'katex-dist'
    'src/help'                     'help'
    'src/examples'                 'examples'
)

declare -a LICENSES_TO_GATHER=(
#   ---package-name---             ---license-file--- <<< (pairs of entries)
    'sprintf'                      'node_modules/sprintf-js/LICENSE'
    'marked'                       'node_modules/marked/LICENSE.md'
    'rxjs'                         'node_modules/rxjs/LICENSE.txt'
    'd3'                           'node_modules/d3/LICENSE'
    'plotly'                       'node_modules/plotly.js-dist/LICENSE'
    'graphviz'                     'node_modules/@hpcc-js/wasm/LICENSE'
    'd3-graphviz'                  'node_modules/d3-graphviz/LICENSE'
    'algebrite'                    'node_modules/algebrite/LICENSE'
)

cd "${ROOT_DIR}"

if [[ -z "${copy_only}" ]]; then
    \rm -fr "${DIST_DIR}"
fi
mkdir -p "${DIST_DIR}"
( cd "${DIST_VERSIONS_DIR}" && ln -sfT "${version_dir}" current )
# no longer used: ( cd "${DIST_DIR}" && echo "export const version_dir = '${version_dir}';" >version-dir.js )

#!!!/usr/bin/env node -e 'require("fs/promises").readFile("README.md").then(t => console.log(`<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n$${require("marked").marked(t.toString())}\n</body>\n</html>`))' > "${DIST_DIR}/help.html"

# copy files before running webpack so that the dist directory is already available to code
echo "copying files..."
for file_index in "${!FILES_TO_COPY[@]}"; do
    declare file="${FILES_TO_COPY[file_index]}"
    cp -a "${file}" "${DIST_DIR}"
done

for (( i = 0; i < ${#DIRECTORIES_TO_COPY[@]}; i += 2 )); do
    declare directory="${DIRECTORIES_TO_COPY[i]}"
    declare destination="${DIRECTORIES_TO_COPY[i+1]}"
    cp -a "${directory}" "${DIST_DIR}/${destination}"
done

declare GATHERED_LICENSES_FILE="${DIST_DIR}/additional-licenses.txt"
declare GATHERED_LICENSES_FILE_SEPARATOR=$'\n======================================================================'
cat >"${GATHERED_LICENSES_FILE}" <<EOF
ADDITIONAL LICENSES FOR COPIED PACKAGES
${GATHERED_LICENSES_FILE_SEPARATOR}
EOF
for (( i = 0; i < ${#LICENSES_TO_GATHER[@]}; i += 2 )); do
    declare package_name="${LICENSES_TO_GATHER[i]}"
    declare license_file="${LICENSES_TO_GATHER[i+1]}"
    { 
        echo "Package: ${package_name}";
        echo;
        cat "${license_file}"
        echo;
        echo "${GATHERED_LICENSES_FILE_SEPARATOR}";
    } >>"${GATHERED_LICENSES_FILE}"
done

if [[ -z "${copy_only}" ]]; then

    echo "building..."
    npx webpack --config ./webpack.config.js

fi

echo "done"
