import express, { Request, Response } from "express"
import OpenAI from "openai"
import dotenv from "dotenv"
dotenv.config() // Load environment variables from .env file

const app = express()
app.use(express.json())

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
})

app.use(express.static("public"))

app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: req.body.message }],
      max_tokens: 150,
    })

    if (gptResponse && gptResponse.choices && gptResponse.choices.length > 0) {
      res.status(200).json({ text: gptResponse.choices[0].message.content })
    } else {
      res.status(500).json({ text: "Failed to get a response from the model." })
    }
  } catch (error) {
    console.error("Error calling OpenAI:", error)
    res.status(500).json({ text: "Internal server error." })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
