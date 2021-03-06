const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Course = require("../models/courseModel");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // Get the currently ordered course
  const course = await Course.findById(req.params.courseId);

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],

    success_url: `${req.protocol}://${req.get("host")}/my-learnings`,
    cancel_url: `${req.protocol}://${req.get("host")}/courses/${course.slug}`,
    customer_email: req.user.email,
    client_reference_id: req.params.courseId,
    line_items: [
      {
        name: `${course.name} Course`,
        description: course.aboutCourse,
        images: [
          `${req.protocol}://${req.get("host")}/img/courses/${
            course.imageCover
          }.svg`
        ],
        amount: course.price * 100,
        currency: "usd",
        quantity: 1
      }
    ]
  });

  // Create session as response
  res.status(200).json({
    status: "success",
    session
  });
});

const createOrderCheckout = async session => {
  const course = session.client_reference_id;
  const user = (await User.findOne({ email: session.customer_email })).id;
  const price = session.amount_total / 100;
  await Order.create({ course, user, price });
};

exports.webhookCheckout = (req, res, next) => {
  const signature = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed")
    createOrderCheckout(event.data.object);

  res.status(200).json({ received: true });
};

exports.createOrder = factory.createOne(Order);
exports.getOrder = factory.getOne(Order);
exports.getAllOrders = factory.getAll(Order);
exports.updateOrder = factory.updateOne(Order);
exports.deleteOrder = factory.deleteOne(Order);
