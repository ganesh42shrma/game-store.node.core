"use strict";

const express = require("express");
const chatController = require("../controllers/chat.controller");
const authenticateJWT = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateJWT);
router.get("/history", chatController.getHistory);
router.get("/threads", chatController.getThreads);
router.delete("/threads/:threadId", chatController.deleteThread);
router.patch("/threads/:threadId", chatController.renameThread);
router.post("/", chatController.chat);

module.exports = router;
