# node_mailsender

Simple node.js mail sender script with docker

# Intended usage

This script is only for developers who are familiar with node.js and basic email sending methods.

# Scenario

You have to send out a lots of html email with dynamic content, which is in csv, and you have a template file.

# Usage

- Edit app.js for mail server / email setting
- Update email_body.html with the desired html code
- Create a test by setting up the infile to test.csv in app.js and filling test.csv
- use ./send.sh fill_queue (it fills the redis queue with the emails)
- use ./send.sh deliver_queue (it reads the queue and send out the email)
 
# Motivation

It's a common scenario to send out a lots of email, and I always want to do things better :) 

- This script is using nodemailer, so the transport can easily deliver via Sendgrid, Amazon SES, etc...
- As it's using redis as queueing, it can be separated to a client / server model so you can build an email sending infrastructure; just scale redis and add clients to work from it's queue and you have a hybrid email sending system.
 
There will be a lots of work if someone wants to use it in production, but if it happens, just let me know and I'll happily assist in the improvements; This thing already did the job what I created for.
