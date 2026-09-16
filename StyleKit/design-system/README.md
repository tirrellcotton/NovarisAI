# Design System

This design system provides a set of reusable styles and components that can be utilized across various applications to ensure consistency and efficiency in design.

## Installation

To install the design system, you can use npm. Run the following command in your project directory:

```
npm install <package-name>
```

Replace `<package-name>` with the name of your design system package.

## Usage

After installing the design system, you can import the styles into your application. Include the main stylesheet in your project:

```css
@import 'path/to/design-system/src/index.css';
```

### Components

The design system includes several components that you can use directly in your application:

- **Chat View**: Styles for the chat interface, including layout and typography.
- **Buttons**: Various button styles for different states and variations.
- **Cards**: Card component styles for displaying content in a structured format.
- **File Components**: Styles for file uploads and previews.

### Tokens

The design system utilizes CSS custom properties (variables) to define design tokens such as colors, spacing, and typography. You can customize these tokens in the `src/tokens/variables.css` file.

### Grid Layout

The grid layout styles are defined in `src/layouts/grid.css`, allowing for responsive design and consistent spacing between elements.

## Examples

Here are some examples of how to use the components in your application:

### Button Example

```html
<button class="btn-primary">Primary Button</button>
<button class="btn-secondary">Secondary Button</button>
```

### Card Example

```html
<div class="card">
    <h3>Card Title</h3>
    <p>Card content goes here.</p>
</div>
```

## Contributing

If you would like to contribute to the design system, please fork the repository and submit a pull request with your changes.

## Azure DevOps

The repository includes an Azure Pipelines definition in `azure-pipelines.yml`. It runs for pushes and pull requests targeting `main` or `master`, installs the Node.js dependencies, builds the stylesheet, and publishes the generated `dist` directory as the `stylekit-css` pipeline artifact.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.