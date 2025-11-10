# Next.js + Shadcn/UI Starter Template

A modern, production-ready template for building web applications with Next.js 14, TypeScript, and Shadcn/UI. This template provides a solid foundation with best practices, modern tooling, and a beautiful, accessible component library out of the box.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.0-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Shadcn/UI](https://img.shields.io/badge/Shadcn%2FUI-0.0.1-22c55e?logo=react&logoColor=white)](https://ui.shadcn.com/)

## ✨ Features

- ⚡ **Next.js 14** with App Router
- 🎨 **Shadcn/UI** components with dark mode
- 🎯 **TypeScript** for type safety
- 🎨 **Tailwind CSS** for styling
- 🌓 **Next Themes** for dark/light mode
- 📏 **ESLint** and **Prettier** for code quality
- 🔄 **React Server Components** ready
- 📱 **Fully responsive** design
- 🔄 **Fast Refresh** for development
- 🛠 **Modern tooling** with `next/font` and `next/image`

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/next-shadcn-starter.git
   cd next-shadcn-starter
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn
   # or
   pnpm install
   # or
   bun install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000) with your browser** to see the result.

## 🛠 Project Structure

```
.
├── src/
│   ├── app/                 # App Router
│   ├── components/          # Reusable components
│   │   ├── ui/             # Shadcn/UI components
│   │   └── theme/          # Theme components
│   ├── lib/                # Utility functions
│   └── styles/             # Global styles
├── public/                 # Static files
└── .github/                # GitHub configurations
```

## 📦 Adding New Components

This project uses Shadcn/UI's CLI to add new components:

```bash
npx shadcn-ui@latest add [component-name]
```

## 🔄 Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-docs) from the creators of Next.js.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API.
- [Shadcn/UI Documentation](https://ui.shadcn.com/docs) - Learn how to use Shadcn/UI components.
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Learn how to style your app with Tailwind.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
