import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import morgan from 'morgan'
import compression from 'compression'
import bodyParser from 'body-parser'
import path from 'path'
import { createStream } from 'rotating-file-stream'
import socket from "./socket"

const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const accessLogStream = createStream('access.log', { interval: '1d', path: path.join(__dirname, 'log')})

app.use(compression())
app.use(cors({ origin: '*' }))
app.use(morgan('combined', { stream: accessLogStream }))

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ type: 'application/*+json' }))
app.use(bodyParser.raw({ type: 'application/vnd.custom-type' }))
app.use(bodyParser.text({ type: 'text/html' }))

app.use(express.static(__dirname + '/media'))
app.use(express.static(__dirname + '/public'))
app.get('*', (req, res) => { res.sendFile(__dirname + '/public/index.html') }) 

mongoose.connect(process.env.DATABASE, {useUnifiedTopology:true, useNewUrlParser:true, useFindAndModify:false, useCreateIndex:true})
mongoose.set('debug', false)

socket(io)

const port = process.env.PORT || 8888
http.listen(port)
console.log('server listening on:', port)