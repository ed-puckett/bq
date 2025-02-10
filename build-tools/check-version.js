#!/usr/bin/env node

const args = process.argv.slice(2);
args.unshift(process.argv[1].replace(/^.*[/]/, ''));

//const package_json = (await import('../package.json', { with: { type: "json" } })).default;
import package_json from '../package.json' with { type: "json" };

function fail_exit(message) {
    console.error(`** ${message}`);
    process.exit(1);
}

function usage_error(message=null) {
    if (message) {
        console.error(`** ${message}\n`);
    }
    console.error(`usage: ${args[0]} {version_number}`);
    console.error(`where: {version_number} is {major}.{minor}`);
    console.error(`        where {major} and {minor} are sequences of decimal digits`);
    process.exit(1);
}

if (args.length !== 2) {
    usage_error();
}

const version_re = /^(?<major>[\d]+)[.](?<minor>[\d]+)(?:[.](?<revision>[\d])+)?$/;

const version = args[1];
const version_match = version.match(version_re);
if (!version_match) {
    usage_error(`bad version number ${typeof version === 'string' ? `"${version}"` : version}`);
}
if (version_match.groups.revision) {
    usage_error(`extraneous revision specified in version number "${version}"`);
}

const package_json_version = package_json.version;
const package_json_version_match = package_json_version?.match(version_re);
if (!package_json_version_match) {
    fail_exit(`bad version number in package.json: ${typeof package_json_version === 'string' ? `"${package_json_version}"` : package_json_version}`);
}

if ( (package_json_version_match.groups.major !== version_match.groups.major) ||
     (package_json_version_match.groups.minor !== version_match.groups.minor)    ) {
    fail_exit(`version "${version_match.groups.major}.${version_match.groups.minor}" does not match package.json version "${package_json_version_match.groups.major}.${package_json_version_match.groups.minor}"`);
}

const {
    major,
    minor,
    revision = 0,
} = package_json_version_match.groups;
console.log(`${major}.${minor}.${revision ?? '0'}`);
