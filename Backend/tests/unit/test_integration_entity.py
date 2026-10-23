from dataclasses import FrozenInstanceError, asdict, replace
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.entities.integration_entity import IntegrationEntity
from app.domain.error.exceptions import ValidationException

NOW = datetime(2026, 10, 23, tzinfo=UTC)


def integration():
    return IntegrationEntity.create("owner", "site", "gsc", "sc-domain:example.com", now=NOW)


def test_integration_preserves_owner_site_source_and_property_identity():
    row = IntegrationEntity.create("owner", "site", "gsc", "sc-domain:example.com", now=datetime(2026, 10, 23, tzinfo=UTC))
    assert isinstance(row, IntegrationEntity)
    assert (row.owner_id, row.website_id, row.source, row.property_id) == ("owner", "site", "gsc", "sc-domain:example.com")
    assert row.revision == 1 and row.retired_at is None
    assert not any("token" in key or "credential" in key for key in asdict(row))
    with pytest.raises(FrozenInstanceError): row.property_id = "different"


@pytest.mark.parametrize("source", ["ga4", "gsc", "ads"])
def test_sources_are_independent_and_properties_are_not_normalized(source):
    value = IntegrationEntity.create("owner", "site", source, "  Exact-Resource/ID  ", now=NOW)
    assert value.source == source and value.property_id == "  Exact-Resource/ID  "


@pytest.mark.parametrize("field,value", [
    ("id", ""), ("owner_id", None), ("website_id", " \t"), ("source", "other"), ("source", None),
    ("property_id", ""), ("property_id", "x" * 2049), ("property_id", "private\nvalue"),
    ("property_id", "\ud800"), ("revision", 0), ("revision", True), ("revision", 2147483648),
    ("created_at", NOW.replace(tzinfo=None)), ("updated_at", NOW - timedelta(seconds=1)),
    ("created_at", None), ("updated_at", None),
    ("retired_at", NOW + timedelta(seconds=1)),
])
def test_invalid_identity_or_state_does_not_echo_input(field, value):
    with pytest.raises(ValidationException) as error: replace(integration(), **{field: value})
    assert "private" not in str(error.value)


def test_renew_and_retire_preserve_identity_and_advance_revision():
    first = integration()
    second = first.renew(now=NOW + timedelta(seconds=1))
    assert second.id == first.id and second.property_id == first.property_id
    assert second.revision == 2 and first.revision == 1
    retired = second.retire(now=NOW + timedelta(seconds=2))
    assert retired.revision == 3 and retired.retired_at == retired.updated_at
    with pytest.raises(ValidationException): retired.renew(now=NOW + timedelta(seconds=3))
    with pytest.raises(ValidationException): second.renew(now=NOW)


@pytest.mark.parametrize("field,value", [
    ("id", "another"), ("owner_id", "another"), ("website_id", "another"),
    ("source", "ads"), ("property_id", "another"), ("revision", 2),
])
def test_credential_context_binds_all_identity_fields_and_revision(field, value):
    first = integration()
    assert first.credential_context() != replace(first, **{field: value}).credential_context()
