// Tell TypeScript that CSS files are valid imports
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
