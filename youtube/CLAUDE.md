# YouTube Playlist Timer - Developer Guide

## Build Commands
- `yarn dev` - Start development server
- `yarn build` - Build for production (runs TypeScript compiler + Vite build)
- `yarn preview` - Preview production build locally

## Type Checking
- TypeScript is configured with strict mode enabled
- Run `tsc --noEmit` to type check without generating output files

## Code Style Guidelines
- Use tabs for indentation
- Use ES modules (`import/export`)
- Prefer arrow functions for callbacks
- Use template literals for string interpolation
- Document functions with JSDoc comments
- Follow TypeScript best practices:
  - Explicit return types for functions
  - Proper error handling with type guards
  - No unused variables or parameters (enforced by tsconfig)
- Use descriptive variable and function names
- Format object literals with trailing commas
- Prefer destructuring for accessing object properties
- Use early returns to reduce nesting
- Always handle edge cases with appropriate validation