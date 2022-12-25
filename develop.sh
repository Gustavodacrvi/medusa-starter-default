#!/bin/bash

#Run migrations to ensure the database is updated
medusa migrations run

medusa seed -f ./data/seed.json

#Start development environment
medusa develop