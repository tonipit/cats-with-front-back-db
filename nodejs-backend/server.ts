import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { fakePets } from './fake-pet-responses';

const app = express();
const port = 3001; // different from your Next.js frontend port

// Middleware
app.use(cors()); // Enables CORS for all routes
app.use(express.json()); // Enables parsing of JSON bodies

// Initialize DB connection
import dotenv from 'dotenv';
dotenv.config();

// ... rest of your imports ...

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

console.log('process.env.DB_DATABASE', process.env.DB_DATABASE);

// DB Query Example
app.get('/api/get-users', async (req, res) => {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM users;');
    client.release();

    res.json({ users: result.rows });
});

// Sample route
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello, world!' });
});

app.get('/api/get-pets', (req, res) => {
    res.json(fakePets);
});

app.post('/api/insert-pets', async (req, res) => {
    console.log('req', req);
    const { pets } = req.body; // Assuming the request body will have the 'pets' property
    console.log('pets', pets);

    let client;

    // Loop through each pet in the JSON data
    for (let pet of pets) {
        const {
            id,
            name,
            animal,
            city,
            state,
            description,
            breed,
            images,
        } = pet;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const catResult = await client.query(
                `INSERT INTO cats (name, animal, city, state, description, breed) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [name, animal, city, state, description, breed]
            );

            const catId = catResult.rows[0].id;

            // Insert images into the 'cat_images' table
            for (let image_url of images) {
                await client.query(
                    `INSERT INTO cat_images (cat_id, image_url) VALUES ($1, $2) ON CONFLICT (image_url) DO NOTHING`,
                    [catId, image_url]
                );
            }

            await client.query('COMMIT');
        } catch (error: any) {
            if (client) {
                await client.query('ROLLBACK');
            }

            console.error('Error inserting data: ', error);

            if (error?.code === '23505') {
                // Unique constraint error code for PostgreSQL
                console.error('Duplicate image detected');
            }

            res.status(500).json({
                error: 'An error occurred while inserting data',
            });
            return; // Important to stop further execution
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    res.status(200).json({ message: 'Data successfully inserted' });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
