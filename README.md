# SyncFlow

A high-concurrency ticketing engine built for the **Vercel & AWS Databases Hackathon** (Track 3: Million-scale global app).

This project uses **Amazon Aurora DSQL** (or any Postgres-compatible DB) and **Next.js** to demonstrate extreme concurrency handling without double-booking inventory.

## 🚀 Features

- **Consumer Drop View:** A sleek, glassmorphic UI where users can attempt to buy a limited ticket.
- **Admin & Concurrency Simulator:** A dashboard to run load tests. Fire 1,000 parallel purchase requests to the API and watch the database effortlessly handle the transaction locks to perfectly sell out exactly 100 tickets with zero oversells.
- **Vercel Serverless Functions:** Backend API handles transaction routing.

## 🛠 Setup Instructions

### 1. Database Configuration
1. Provision an **Amazon Aurora DSQL** cluster in your AWS account.
2. Obtain the Postgres connection string.
3. Copy `.env.local.example` to `.env.local` and add your `DATABASE_URL`.

### 2. Initialize the Database
Run the initialization script to create the schema and seed it with exactly 100 tickets:
```bash
npm run db:init
```

### 3. Run Locally
```bash
npm run dev
```
Visit `http://localhost:3000` for the consumer drop and `http://localhost:3000/admin` for the load tester dashboard.

## ☁️ Deployment

This app is optimized for Vercel. 
1. Push this repository to GitHub.
2. Import the project in Vercel.
3. Add your `DATABASE_URL` to the Vercel Environment Variables.
4. Deploy!
