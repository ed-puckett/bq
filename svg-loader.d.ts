// for webpack asset loader
declare module '*.svg' {
    const content: any;
    export default content;
}
