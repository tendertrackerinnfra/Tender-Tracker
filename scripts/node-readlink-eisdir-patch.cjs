const fs = require("fs");

function normalizeReadlinkError(error) {
  if (error && error.code === "EISDIR" && error.syscall === "readlink") {
    error.code = "EINVAL";
  }
  return error;
}

const originalReadlinkSync = fs.readlinkSync;
fs.readlinkSync = function patchedReadlinkSync(...args) {
  try {
    return originalReadlinkSync.apply(this, args);
  } catch (error) {
    throw normalizeReadlinkError(error);
  }
};

const originalReadlink = fs.readlink;
fs.readlink = function patchedReadlink(...args) {
  const callback = args[args.length - 1];
  if (typeof callback === "function") {
    args[args.length - 1] = function patchedCallback(error, ...values) {
      callback(normalizeReadlinkError(error), ...values);
    };
  }
  return originalReadlink.apply(this, args);
};

if (fs.promises?.readlink) {
  const originalPromiseReadlink = fs.promises.readlink;
  fs.promises.readlink = async function patchedPromiseReadlink(...args) {
    try {
      return await originalPromiseReadlink.apply(this, args);
    } catch (error) {
      throw normalizeReadlinkError(error);
    }
  };
}
