# 🦸‍♂️ Unsub Hero

![Next.js](https://img.shields.io/badge/Next.js-15.x-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.x-blue?style=for-the-badge&logo=react)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)

Welcome to **Unsub Hero** – a modern, high-performance, and fully responsive landing page application built with the latest web technologies. Designed with sleek aesthetics and a robust component architecture, Unsub Hero serves as an ideal template or starting point for your next big idea.

## ✨ Features

- **Modern Tech Stack**: Built with Next.js 15 (App Router), React 19, and Tailwind CSS v4.
- **TypeScript Ready**: Strongly typed for better developer experience and reliability.
- **Component-Driven Architecture**: Modular, reusable components (`Hero`, `Services`, `Testimonials`, `Blog`, etc.).
- **Fully Responsive**: Optimized for mobile, tablet, and desktop viewing.
- **SEO Optimized**: Leveraging Next.js built-in SEO capabilities.
- **Fast Performance**: Next.js optimized rendering and lightweight styling.

---

## 🏗️ Project Structure

The project follows a clean and intuitive directory structure:

```text
unsub_hero/
├── public/                 # Static assets (images, icons, etc.)
├── src/
│   ├── app/                # Next.js App Router (pages, layout, globals.css)
│   ├── components/         # Reusable React components
│   │   ├── About.tsx       # About section
│   │   ├── Blog.tsx        # Blog showcase
│   │   ├── Cta.tsx         # Call to Action section
│   │   ├── Expertise.tsx   # Expertise/Skills section
│   │   ├── Footer.tsx      # Application Footer
│   │   ├── Hero.tsx        # Hero banner
│   │   ├── LogoMarquee.tsx # Scrolling client/partner logos
│   │   ├── Navbar.tsx      # Navigation Bar
│   │   ├── Services.tsx    # Services offered
│   │   ├── TemplateOverlay.tsx
│   │   └── Testimonials.tsx# User testimonials
└── package.json            # Project dependencies and scripts
```

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.17.0 or higher recommended)
- `npm`, `yarn`, `pnpm`, or `bun`

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/RaghavEscada/Unsub_Hero.git
   cd Unsub_Hero
   ```

2. **Install dependencies:**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Run the development server:**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. **Open your browser:**

   Navigate to [http://localhost:3000](http://localhost:3000) to see the application in action. The page will automatically reload if you make edits to the code.

---

## 🛠️ Available Scripts

In the project directory, you can run the following commands:

- **`npm run dev`**: Starts the development server.
- **`npm run build`**: Builds the app for production to the `.next` folder.
- **`npm start`**: Starts the production server using the built app.
- **`npm run lint`**: Runs ESLint to catch and fix code issues.

---

## 🎨 Customization

### Styling
This project utilizes **Tailwind CSS v4**. You can modify global styles in `src/app/globals.css`. Configuration for Tailwind can be managed directly or through PostCSS plugins (`postcss.config.mjs`).

### Content
To change the content of the landing page, navigate to `src/app/page.tsx` and the individual components within `src/components/`. The modular design allows you to easily swap, remove, or duplicate sections.

---

## 🌐 Deployment

The easiest way to deploy this Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

1. Push your code to a Git repository (GitHub, GitLab, Bitbucket).
2. Import your project into Vercel.
3. Vercel will automatically detect that it's a Next.js project and configure the build settings.
4. Click **Deploy**.

For more details, check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
