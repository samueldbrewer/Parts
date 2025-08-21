#!/bin/sh

echo "Starting Parts API..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Warning: DATABASE_URL is not set. Database features will not work."
    echo "Please add a PostgreSQL database to your Railway project."
else
    echo "DATABASE_URL found. Running migrations..."
    npx prisma generate
    npx prisma migrate deploy
fi

# Start the application
echo "Starting Node.js application..."
npm start