import axios, { AxiosResponse } from 'axios'
import { env } from './config/env'
import { SearchRequest, DateRangeRequest } from '../schemas/conversation.schema'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({path: path.resolve(__dirname, '../../../.env')})

const client = axios.create({
    baseURL: env.API_URL,
    headers: { 'Authorization': `Bearer ${env.API_KEY}`}
})

export async function searchConversations(params: SearchRequest){
    const response: AxiosResponse = await client.get('/conversations/search', { params })
    return response.data
}

export async function getByDateRange(params: DateRangeRequest){
    const response: AxiosResponse = await client.get('/conversations/date-range', { params })
    return response.data
}

