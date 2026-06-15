# 📁 Components Directory

This directory contains all the reusable and page-specific React components organized by their purpose and level of abstraction.

## Folder Structure

```
Components/
├── UI/         # Primitive UI elements (e.g., Button, Input, Modal)
├── Common/     # Base building blocks composed of primitives (e.g., Form, Card, ActionButton)
├── Shared/     # Specialized components reused across multiple pages (e.g., DirectoryTree, BillingUnavailable)
├── Layout/     # Layout components that apply to all pages (e.g., NavBar, LoadingScreen)
├── Pages/      # Components unique to specific pages (e.g., Usage, Interfaces)
```

### Folder Descriptions

- **UI/**
  Contains low-level, reusable UI primitives such as buttons, inputs, and other styled components. These are stateless, style-driven elements used across the application.

- **Common/**
  Houses mid-level components composed of UI primitives. These serve as foundational blocks (e.g., headers, footers, form layouts) and are often reused throughout the app.

- **Shared/**
  Includes specialized components that are reused across different pages but are more domain-specific than Common components.

- **Layout/**
  Components related to the overall layout of the app.

- **Pages/**
  Contains components that are specific to individual pages or views. These are not meant to be reused elsewhere in the app.
