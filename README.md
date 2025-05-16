# Th3-Sh0p Portfolio

This repository contains the personal and professional portfolio website for **Adam Williams** (aka Th3-Sh0p), a full stack developer, business owner, and combat veteran. The site showcases Adam's skills, experience, and selected projects, and provides a way to contact him directly.

## Features

- **About & Resume**: Learn about Adam's background, skills, and download his resume in multiple formats.
- **Project Portfolio**: Explore detailed pages for various software projects Adam has worked on.
- **Contact Form**: Visitors can send messages directly via a PHP-powered contact form.
- **Responsive Design**: Built with Bootstrap and custom CSS for a modern, mobile-friendly experience.
- **Social Links**: Connect via LinkedIn and Facebook.

## Directory Structure

- `index.html` — Main landing page (About, Skills, Experience, Education, Contact)
- `projects/` — Individual project showcase pages and subdirectories for project assets
- `assets/` — Images, SVGs, and multiple resume formats (PDF, DOCX, HTML)
- `css/` — Bootstrap, custom styles, and third-party CSS
- `js/` — Custom scripts and third-party JavaScript libraries
- `send.php` — Handles contact form submissions and sends emails
- `Dockerfile` — For running the site in a Lighttpd Docker container
- `composer.json` — PHP dependencies (PHPMailer, HTML2PDF)

## Running Locally

### Prerequisites
- PHP (for contact form functionality)
- Composer (for PHP dependencies)
- Docker (optional, for containerized setup)

### 1. Clone the Repository
```bash
git clone <repo-url>
cd th3-sh0p
```

### 2. Run with Docker (Recommended)
```bash
docker build -t th3-sh0p .
docker run -p 8080:80 th3-sh0p
```
Visit [http://localhost:8080](http://localhost:8080) in your browser.

### 3. Or Run with a Local Web Server
You can use PHP's built-in server for static/demo purposes:
```bash
php -S localhost:8080
```

## Contact Form
- The contact form on the site uses `send.php` to send emails to Adam's address.
- Make sure your server supports sending mail via PHP, or configure SMTP as needed.

## Customization
- Update `index.html` and project files in `projects/` to add or modify content.
- Replace or add assets in the `assets/` directory as needed.

## License
This project is for personal/portfolio use. For other uses, please contact Adam Williams.

---

**Adam Williams**  
[LinkedIn](https://www.linkedin.com/in/awilliams1989)  
[Facebook](https://www.facebook.com/awilliams1989/) 