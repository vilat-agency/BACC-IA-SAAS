import mongoose from "mongoose";

const { Schema, model, models, Types } = mongoose;

const historySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true },
    problem: { type: String, default: "" },
    result: { type: String, required: true },
  },
  { timestamps: true }
);

export const History = models.History || model("History", historySchema);
