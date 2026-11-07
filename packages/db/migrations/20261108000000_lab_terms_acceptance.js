/**
 * Records that a lab accepted the Terms and Privacy Policy at signup: which
 * version, when, and the email that did it. NULL for labs created before this,
 * which still need to accept.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("labs", (table) => {
    table.string("terms_version").nullable();
    table.timestamp("terms_accepted_at").nullable();
    table.string("terms_accepted_by_email").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("labs", (table) => {
    table.dropColumn("terms_version");
    table.dropColumn("terms_accepted_at");
    table.dropColumn("terms_accepted_by_email");
  });
};
