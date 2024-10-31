const current_script_url = import.meta.url;  // grab right away for later

import { fileURLToPath } from "node:url";
import { LicenseWebpackPlugin } from 'license-webpack-plugin';

const src_dir_path  = fileURLToPath(new URL("./src",  current_script_url));
const lib_dir_path  = fileURLToPath(new URL("./lib",  current_script_url));
const dist_dir_path = fileURLToPath(new URL("./dist", current_script_url));

const webpack_config = {
    entry: './src/init.ts',
    mode:  'production',

    output: {
        path: dist_dir_path,
        filename: 'init.js',
    },

    devtool: 'source-map',
    optimization: {
//        minimize: true,
        minimize: false,
    },

    stats: {
        errorDetails: true,
    },

    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        alias: {  // permit module-like direct access to these directories from anywhere, even subdirectories
            lib:  lib_dir_path,
            src:  src_dir_path,
            dist: dist_dir_path,
        },
    },

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },

    plugins: [
        new LicenseWebpackPlugin(),
    ],
};

export default webpack_config;
