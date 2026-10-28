const { checkUrlTarget, isBlockedAddress } = require("../monitoring/ssrf");

describe("checkUrlTarget", () => {
  test.each([
    "https://example.com/health",
    "http://api.example.com:8080/v1",
    "https://8.8.8.8/",
    "https://[2606:4700::1111]/",
  ])("allows public target %s", (url) => {
    expect(checkUrlTarget(url)).toBeNull();
  });

  test.each([
    ["http://localhost:5000/", "Local and internal hostnames"],
    ["http://api.localhost/", "Local and internal hostnames"],
    ["http://metadata.google.internal/", "Local and internal hostnames"],
    ["http://127.0.0.1/", "Private, loopback"],
    ["http://2130706433/", "Private, loopback"], // decimal 127.0.0.1
    ["http://0x7f.1/", "Private, loopback"], // hex shorthand 127.0.0.1
    ["http://169.254.169.254/latest/meta-data/", "Private, loopback"],
    ["http://10.0.0.5/", "Private, loopback"],
    ["http://172.16.0.1/", "Private, loopback"],
    ["http://192.168.1.1/", "Private, loopback"],
    ["http://[::1]/", "Private, loopback"],
    ["http://[::ffff:127.0.0.1]/", "Private, loopback"],
    ["http://[fd00:ec2::254]/", "Private, loopback"],
    ["ftp://example.com/", "Only http and https"],
    ["http://user:secret@example.com/", "credentials"],
    ["not a url", "Invalid URL"],
  ])("blocks %s", (url, reason) => {
    expect(checkUrlTarget(url)).toEqual(expect.stringContaining(reason));
  });
});

describe("isBlockedAddress", () => {
  test.each(["172.66.147.243", "8.8.8.8", "172.32.0.1", "2606:4700:10::6814:179a"])("allows public address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  test.each(["172.31.255.255", "100.64.0.1", "0.0.0.0", "255.255.255.255", "fe80::1", "::ffff:8.8.8.8", "not-an-ip"])(
    "blocks %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(true);
    },
  );
});
